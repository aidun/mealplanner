package httpapi

import (
	"context"
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
	userIDKey contextKey = "userID"
	csrfKey   contextKey = "csrf"
	adminKey  contextKey = "admin"
)

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || strings.TrimSpace(req.Password) == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	userID, created, err := h.repo.RegisterUser(r, email, hash)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	if !created {
		writeError(w, http.StatusConflict, "email already registered")
		return
	}
	sessionID, _, expiresAt, err := h.repo.CreateSession(r, userID, 30*24*time.Hour)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	h.setSessionCookie(w, sessionID, expiresAt)
	writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	userID, hash, found, err := h.repo.GetUserByEmail(r, email)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	// Always run CheckPassword to prevent timing-based user enumeration.
	const dummyHash = "$2a$10$YIJeB3PfMkZQW8Xu9u5xtOoQxWQjZrVjXjJMsHpP7NfBqRZ0kVWkC"
	checkHash := hash
	if !found {
		checkHash = dummyHash
	}
	if !auth.CheckPassword(checkHash, req.Password) || !found {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	sessionID, _, expiresAt, err := h.repo.CreateSession(r, userID, 30*24*time.Hour)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	h.setSessionCookie(w, sessionID, expiresAt)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) getSession(w http.ResponseWriter, r *http.Request) {
	userID, csrf, _, ok := h.readSession(r)
	if !ok {
		if !h.authRequired {
			guestID, err := h.repo.EnsureGuestAdmin(r)
			if err != nil {
				h.serverError(w, r, err)
				return
			}
			sessionID, csrfToken, expiresAt, err := h.repo.CreateSession(r, guestID, 30*24*time.Hour)
			if err != nil {
				h.serverError(w, r, err)
				return
			}
			h.setSessionCookie(w, sessionID, expiresAt)
			userID = guestID
			csrf = csrfToken
		} else {
			writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
			return
		}
	}
	isAdmin, err := h.repo.IsAdminUser(r, userID)
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
		"isAdmin":            isAdmin,
		"csrfToken":          csrf,
		"onboardingRequired": domain.IsPlaceholderProfile(profile) && !hasSeenOnboarding,
	})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(auth.SessionCookieName); err == nil {
		_ = h.repo.DeleteSession(r, cookie.Value)
	}
	h.clearCookie(w, auth.SessionCookieName, "/")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) withSession(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, csrf, _, ok := h.readSession(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		isAdmin, err := h.repo.IsAdminUser(r, userID)
		if err != nil {
			h.serverError(w, r, err)
			return
		}
		ctx := context.WithValue(r.Context(), userIDKey, userID)
		ctx = context.WithValue(ctx, csrfKey, csrf)
		ctx = context.WithValue(ctx, adminKey, isAdmin)
		next(w, r.WithContext(ctx))
	}
}

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

func (h *Handler) setSessionCookie(w http.ResponseWriter, sessionID string, expiresAt time.Time) {
	// #nosec G124 -- Secure is intentionally configurable via SESSION_SECURE env var for HTTP-only deployments.
	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookieName,
		Value:    sessionID,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *Handler) clearCookie(w http.ResponseWriter, name, path string) {
	// #nosec G124 -- Secure is intentionally configurable via SESSION_SECURE env var for HTTP-only deployments.
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     path,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}
