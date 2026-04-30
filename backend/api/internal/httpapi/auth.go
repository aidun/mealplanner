package httpapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/auth"
	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/aidun/mealplanner/backend/api/internal/store"
)

type contextKey string

const (
	userIDKey  contextKey = "userID"
	csrfKey    contextKey = "csrf"
	emailKey   contextKey = "email"
	adminKey   contextKey = "admin"
	premiumKey contextKey = "premium"
)

// oauthState is kept in an HttpOnly cookie while the provider roundtrip is in progress.
type oauthState struct {
	State    string `json:"state"`
	Nonce    string `json:"nonce"`
	Verifier string `json:"verifier"`
}

func (h *Handler) getAuthProviders(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"providers": h.auth.Providers()})
}

// getSession returns frontend boot data without leaking anything for anonymous visitors.
func (h *Handler) getSession(w http.ResponseWriter, r *http.Request) {
	userID, csrf, _, ok := h.readSession(r)
	if !ok {
		writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
		return
	}
	email, err := h.repo.GetUserEmail(r, userID)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	isPremium, err := h.repo.IsPremiumUser(r, userID)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	sessionRequest := r.WithContext(context.WithValue(r.Context(), userIDKey, userID))
	profile, err := h.repo.GetProfile(sessionRequest)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	hasSeenOnboarding, err := h.repo.HasSeenProfileOnboarding(sessionRequest, userID)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"authenticated":      true,
		"userID":             userID,
		"email":              email,
		"isAdmin":            isAdminEmail(email),
		"isPremium":          isPremium,
		"csrfToken":          csrf,
		"onboardingRequired": domain.IsPlaceholderProfile(profile) && !hasSeenOnboarding,
	})
}

// startGoogle supports both normal browser redirects and XHR starts used by the React login page.
func (h *Handler) startGoogle(w http.ResponseWriter, r *http.Request) {
	if !h.auth.GoogleEnabled() {
		writeError(w, http.StatusServiceUnavailable, "google login is not configured")
		return
	}
	state, nonce, verifier, challenge, err := auth.NewOAuthState()
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	raw, _ := json.Marshal(oauthState{State: state, Nonce: nonce, Verifier: verifier})
	http.SetCookie(w, &http.Cookie{
		Name:     auth.StateCookieName,
		Value:    encodeCookie(raw),
		Path:     "/api/auth/google",
		MaxAge:   600,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	redirectURL := h.auth.GoogleStartURL(state, nonce, challenge)
	if strings.Contains(r.Header.Get("Accept"), "application/json") || strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Requested-With")), "XMLHttpRequest") {
		writeJSON(w, http.StatusOK, map[string]string{"redirectUrl": redirectURL})
		return
	}
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// googleCallback verifies the stored state before any token exchange to keep the OAuth flow CSRF-safe.
func (h *Handler) googleCallback(w http.ResponseWriter, r *http.Request) {
	var saved oauthState
	cookie, err := r.Cookie(auth.StateCookieName)
	if err != nil || decodeCookie(cookie.Value, &saved) != nil || saved.State == "" || saved.State != r.URL.Query().Get("state") {
		h.logger.Warn(
			"oauth state validation failed",
			"path", r.URL.Path,
			"has_cookie", err == nil,
			"has_query_state", strings.TrimSpace(r.URL.Query().Get("state")) != "",
		)
		writeError(w, http.StatusBadRequest, auth.ErrInvalidState.Error())
		return
	}
	if r.URL.Query().Get("error") != "" {
		writeError(w, http.StatusBadRequest, r.URL.Query().Get("error"))
		return
	}
	identity, err := h.auth.ExchangeGoogleCode(r.Context(), r.URL.Query().Get("code"), saved.Verifier, saved.Nonce)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	allowed, err := h.repo.LoginAllowed(r, identity.Email, identity.EmailHash)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	if !allowed {
		writeError(w, http.StatusForbidden, "login not allowed")
		return
	}
	userID, err := h.repo.UpsertUser(r, identity.Provider, identity.SubjectHash, identity.Email, identity.EmailHash)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	sessionID, _, expiresAt, err := h.repo.CreateSession(r, userID, 30*24*time.Hour)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	setSessionCookie(w, r, sessionID, expiresAt)
	clearCookie(w, auth.StateCookieName, "/api/auth/google")
	http.Redirect(w, r, "/", http.StatusFound)
}

func (h *Handler) appleNotConfigured(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusNotImplemented, "apple login is prepared but not configured")
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(auth.SessionCookieName); err == nil {
		_ = h.repo.DeleteSession(r, cookie.Value)
	}
	clearCookie(w, auth.SessionCookieName, "/")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// withSession enriches the request context with account, admin and family-level premium flags.
func (h *Handler) withSession(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, csrf, _, ok := h.readSession(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		email, err := h.repo.GetUserEmail(r, userID)
		if err != nil {
			h.serverError(w, r, err)
			return
		}
		isPremium, err := h.repo.IsPremiumUser(r, userID)
		if err != nil {
			h.serverError(w, r, err)
			return
		}
		ctx := context.WithValue(r.Context(), userIDKey, userID)
		ctx = context.WithValue(ctx, csrfKey, csrf)
		ctx = context.WithValue(ctx, emailKey, email)
		ctx = context.WithValue(ctx, adminKey, isAdminEmail(email))
		ctx = context.WithValue(ctx, premiumKey, isPremium)
		next(w, r.WithContext(ctx))
	}
}

// withCSRF protects mutating cookie-authenticated routes with the session-scoped token.
func (h *Handler) withCSRF(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		csrf, _ := r.Context().Value(csrfKey).(string)
		if csrf == "" || strings.TrimSpace(r.Header.Get("X-CSRF-Token")) != csrf {
			writeError(w, http.StatusForbidden, "csrf token required")
			return
		}
		next(w, r)
	}
}

func (h *Handler) withAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		isAdmin, _ := r.Context().Value(adminKey).(bool)
		if !isAdmin {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		next(w, r)
	}
}

// withPremium lets the hard-privileged admin use support flows even without a normal premium grant.
func (h *Handler) withPremium(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		isPremium, _ := r.Context().Value(premiumKey).(bool)
		isAdmin, _ := r.Context().Value(adminKey).(bool)
		if !isPremium && !isAdmin {
			writeError(w, http.StatusForbidden, "premium required")
			return
		}
		next(w, r)
	}
}

// readSession treats missing or expired sessions as anonymous and logs only unexpected store failures.
func (h *Handler) readSession(r *http.Request) (string, string, time.Time, bool) {
	cookie, err := r.Cookie(auth.SessionCookieName)
	if err != nil || cookie.Value == "" {
		return "", "", time.Time{}, false
	}
	userID, csrf, expiresAt, err := h.repo.GetSession(r, cookie.Value)
	if errors.Is(err, store.ErrNotFound) {
		return "", "", time.Time{}, false
	}
	if err != nil {
		h.logger.Error("session lookup failed", "error", err)
		return "", "", time.Time{}, false
	}
	return userID, csrf, expiresAt, true
}

func mustUserID(ctx context.Context) string {
	userID, _ := ctx.Value(userIDKey).(string)
	if userID == "" {
		panic("missing authenticated user id")
	}
	return userID
}

func isAdminEmail(email string) bool {
	return strings.EqualFold(strings.TrimSpace(email), "markush1986@gmail.com")
}

func setSessionCookie(w http.ResponseWriter, _ *http.Request, sessionID string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookieName,
		Value:    sessionID,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

func clearCookie(w http.ResponseWriter, name, path string) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     path,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

func encodeCookie(raw []byte) string {
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeCookie(value string, target any) error {
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, target)
}
