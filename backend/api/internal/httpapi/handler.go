package httpapi

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/auth"
	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/aidun/mealplanner/backend/api/internal/planner"
	"github.com/aidun/mealplanner/backend/api/internal/provider"
	"github.com/aidun/mealplanner/backend/api/internal/store"
)

type Repository interface {
	UpsertUser(r *http.Request, provider, subjectHash string, email string, emailHash string) (string, error)
	CreateSession(r *http.Request, userID string, ttl time.Duration) (string, string, time.Time, error)
	GetSession(r *http.Request, sessionID string) (string, string, time.Time, error)
	DeleteSession(r *http.Request, sessionID string) error
	ListUserIDs(r *http.Request) ([]string, error)
	GetFamily(r *http.Request) (domain.FamilySummary, error)
	CreateFamilyInvite(r *http.Request, emailHash string, ttl time.Duration) (domain.FamilyInvite, string, error)
	AcceptFamilyInvite(r *http.Request, token string, mergedProfile domain.Profile) (domain.FamilySummary, error)
	UpdateFamilyMemberLink(r *http.Request, accountUserID string, memberID string) (domain.FamilySummary, error)
	UserEmailHash(r *http.Request) (string, error)
	GetProfileByFamily(r *http.Request, familyID string) (domain.Profile, error)
	InviteTargetFamily(r *http.Request, token string) (string, error)
	GetProfile(r *http.Request) (domain.Profile, error)
	SaveProfile(r *http.Request, profile domain.Profile) (domain.Profile, error)
	SavePlan(r *http.Request, plan domain.Plan) (domain.Plan, error)
	GetCurrentPlan(r *http.Request) (domain.Plan, error)
	GetPlan(r *http.Request, id string) (domain.Plan, error)
	GetPlanByID(r *http.Request, id string) (domain.Plan, error)
	ListFavorites(r *http.Request) ([]domain.FavoriteRecipe, error)
	SaveFavorite(r *http.Request, meal domain.Meal) (domain.FavoriteRecipe, error)
	DeleteFavorite(r *http.Request, id string) error
	SavePromptDebug(r *http.Request, entry domain.PromptDebugEntry) error
	LatestPromptDebug(r *http.Request) (domain.PromptDebugEntry, error)
	ListPromptDebug(r *http.Request, limit int) ([]domain.PromptDebugEntry, error)
}

type StoreRepository struct {
	Store store.Store
}

func (r StoreRepository) UpsertUser(req *http.Request, provider, subjectHash string, email string, emailHash string) (string, error) {
	return r.Store.UpsertUser(req.Context(), provider, subjectHash, email, emailHash)
}

func (r StoreRepository) CreateSession(req *http.Request, userID string, ttl time.Duration) (string, string, time.Time, error) {
	return r.Store.CreateSession(req.Context(), userID, ttl)
}

func (r StoreRepository) GetSession(req *http.Request, sessionID string) (string, string, time.Time, error) {
	return r.Store.GetSession(req.Context(), sessionID)
}

func (r StoreRepository) DeleteSession(req *http.Request, sessionID string) error {
	return r.Store.DeleteSession(req.Context(), sessionID)
}

func (r StoreRepository) ListUserIDs(req *http.Request) ([]string, error) {
	return r.Store.ListUserIDs(req.Context())
}

func (r StoreRepository) GetFamily(req *http.Request) (domain.FamilySummary, error) {
	return r.Store.GetFamily(req.Context(), mustUserID(req.Context()))
}

func (r StoreRepository) CreateFamilyInvite(req *http.Request, emailHash string, ttl time.Duration) (domain.FamilyInvite, string, error) {
	return r.Store.CreateFamilyInvite(req.Context(), mustUserID(req.Context()), emailHash, ttl)
}

func (r StoreRepository) AcceptFamilyInvite(req *http.Request, token string, mergedProfile domain.Profile) (domain.FamilySummary, error) {
	return r.Store.AcceptFamilyInvite(req.Context(), mustUserID(req.Context()), token, mergedProfile)
}

func (r StoreRepository) UpdateFamilyMemberLink(req *http.Request, accountUserID string, memberID string) (domain.FamilySummary, error) {
	return r.Store.UpdateFamilyMemberLink(req.Context(), mustUserID(req.Context()), accountUserID, memberID)
}

func (r StoreRepository) UserEmailHash(req *http.Request) (string, error) {
	return r.Store.UserEmailHash(req.Context(), mustUserID(req.Context()))
}

func (r StoreRepository) GetProfileByFamily(req *http.Request, familyID string) (domain.Profile, error) {
	return r.Store.GetProfileByFamily(req.Context(), familyID)
}

func (r StoreRepository) InviteTargetFamily(req *http.Request, token string) (string, error) {
	return r.Store.InviteTargetFamily(req.Context(), token)
}

func (r StoreRepository) GetProfile(req *http.Request) (domain.Profile, error) {
	return r.Store.GetProfile(req.Context(), mustUserID(req.Context()))
}

func (r StoreRepository) SaveProfile(req *http.Request, profile domain.Profile) (domain.Profile, error) {
	return r.Store.SaveProfile(req.Context(), mustUserID(req.Context()), profile)
}

func (r StoreRepository) SavePlan(req *http.Request, plan domain.Plan) (domain.Plan, error) {
	return r.Store.SavePlan(req.Context(), mustUserID(req.Context()), plan)
}

func (r StoreRepository) GetCurrentPlan(req *http.Request) (domain.Plan, error) {
	return r.Store.GetCurrentPlan(req.Context(), mustUserID(req.Context()))
}

func (r StoreRepository) GetPlan(req *http.Request, id string) (domain.Plan, error) {
	return r.Store.GetPlan(req.Context(), mustUserID(req.Context()), id)
}

func (r StoreRepository) GetPlanByID(req *http.Request, id string) (domain.Plan, error) {
	return r.Store.GetPlanByID(req.Context(), id)
}

func (r StoreRepository) ListFavorites(req *http.Request) ([]domain.FavoriteRecipe, error) {
	return r.Store.ListFavorites(req.Context(), mustUserID(req.Context()))
}

func (r StoreRepository) SaveFavorite(req *http.Request, meal domain.Meal) (domain.FavoriteRecipe, error) {
	return r.Store.SaveFavorite(req.Context(), mustUserID(req.Context()), meal)
}

func (r StoreRepository) DeleteFavorite(req *http.Request, id string) error {
	return r.Store.DeleteFavorite(req.Context(), mustUserID(req.Context()), id)
}

func (r StoreRepository) SavePromptDebug(req *http.Request, entry domain.PromptDebugEntry) error {
	return r.Store.SavePromptDebug(req.Context(), mustUserID(req.Context()), entry)
}

func (r StoreRepository) LatestPromptDebug(req *http.Request) (domain.PromptDebugEntry, error) {
	return r.Store.LatestPromptDebug(req.Context(), mustUserID(req.Context()))
}

func (r StoreRepository) ListPromptDebug(req *http.Request, limit int) ([]domain.PromptDebugEntry, error) {
	return r.Store.ListPromptDebug(req.Context(), mustUserID(req.Context()), limit)
}

type Handler struct {
	repo        Repository
	planner     planner.Planner
	auth        auth.Service
	metrics     *Metrics
	apiSecret   string
	corsOrigins []string
	logger      *slog.Logger
	promptDebug bool
	rateLimiter *rateLimiter
}

const maxJSONBodyBytes = 1 << 20

func New(repo Repository, planner planner.Planner, authService auth.Service, apiSecret string, corsOrigins []string, logger *slog.Logger) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	appEnv := strings.ToLower(strings.TrimSpace(getenv("APP_ENV")))
	if appEnv == "" {
		appEnv = "development"
	}
	h := &Handler{
		repo:        repo,
		planner:     planner,
		auth:        authService,
		metrics:     NewMetrics(),
		apiSecret:   strings.TrimSpace(apiSecret),
		corsOrigins: corsOrigins,
		logger:      logger,
		promptDebug: appEnv == "test" && strings.EqualFold(strings.TrimSpace(getenv("PROMPT_DEBUG")), "true"),
		rateLimiter: newRateLimiter(rateLimitFromEnv(), time.Minute),
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", h.health)
	mux.Handle("GET /metrics", h.metrics)
	mux.HandleFunc("GET /api/auth/providers", h.getAuthProviders)
	mux.HandleFunc("GET /api/auth/google/start", h.startGoogle)
	mux.HandleFunc("GET /api/auth/google/callback", h.googleCallback)
	mux.HandleFunc("GET /api/auth/apple/start", h.appleNotConfigured)
	mux.HandleFunc("GET /api/auth/apple/callback", h.appleNotConfigured)
	mux.HandleFunc("GET /api/session", h.getSession)
	mux.HandleFunc("POST /api/auth/logout", h.withSession(h.withCSRF(h.logout)))
	mux.HandleFunc("POST /api/internal/plans/weekly", h.withAPI(h.createPlansForAllUsers))
	mux.HandleFunc("GET /api/profile", h.withSession(h.getProfile))
	mux.HandleFunc("PUT /api/profile", h.withSession(h.withCSRF(h.putProfile)))
	mux.HandleFunc("GET /api/family", h.withSession(h.getFamily))
	mux.HandleFunc("POST /api/family/invites", h.withSession(h.withCSRF(h.createFamilyInvite)))
	mux.HandleFunc("POST /api/family/invites/accept", h.withSession(h.withCSRF(h.acceptFamilyInvite)))
	mux.HandleFunc("PUT /api/family/member-links", h.withSession(h.withCSRF(h.updateFamilyMemberLink)))
	mux.HandleFunc("GET /api/favorites", h.withSession(h.getFavorites))
	mux.HandleFunc("POST /api/favorites", h.withSession(h.withCSRF(h.createFavorite)))
	mux.HandleFunc("DELETE /api/favorites/{favoriteID}", h.withSession(h.withCSRF(h.deleteFavorite)))
	mux.HandleFunc("GET /api/debug/prompts/latest", h.withSession(h.getLatestPromptDebug))
	mux.HandleFunc("POST /api/plans", h.withSession(h.withCSRF(h.createPlan)))
	mux.HandleFunc("GET /api/plans/current", h.withSession(h.getCurrentPlan))
	mux.HandleFunc("GET /api/plans/{planID}/bring-export", h.getBringExport)
	mux.HandleFunc("GET /api/plans/{planID}/bring-export-url", h.withSession(h.getBringExportURL))
	mux.HandleFunc("GET /api/plans/{planID}/shopping-list", h.withSession(h.getShoppingList))
	mux.HandleFunc("POST /api/plans/{planID}/meals/{mealID}/regenerate", h.withSession(h.withCSRF(h.regenerateMeal)))
	handler := h.withRecover(mux)
	handler = h.withRequestContext(handler)
	handler = h.withRateLimit(handler)
	handler = h.withSecurityHeaders(handler)
	handler = h.withCORS(handler)
	return h.metrics.Middleware(handler)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) getProfile(w http.ResponseWriter, r *http.Request) {
	profile, err := h.repo.GetProfile(r)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (h *Handler) putProfile(w http.ResponseWriter, r *http.Request) {
	var profile domain.Profile
	if err := decodeJSON(w, r, &profile); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := profile.Validate(); err != nil {
		writeError(w, http.StatusBadRequest, "Bitte prüfe die Profilangaben.")
		return
	}
	saved, err := h.repo.SaveProfile(r, profile)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (h *Handler) getFamily(w http.ResponseWriter, r *http.Request) {
	family, err := h.repo.GetFamily(r)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, family)
}

func (h *Handler) createFamilyInvite(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateFamilyInviteRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	emailHash := h.auth.Hash("email:" + strings.ToLower(strings.TrimSpace(req.Email)))
	if strings.TrimSpace(req.Email) == "" {
		writeError(w, http.StatusBadRequest, "Bitte gib eine E-Mail-Adresse an.")
		return
	}
	invite, token, err := h.repo.CreateFamilyInvite(r, emailHash, 7*24*time.Hour)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	invite.InviteLink = h.absoluteRequestURL(r, "/family/invites/accept").String() + "?token=" + token
	writeJSON(w, http.StatusCreated, invite)
}

func (h *Handler) acceptFamilyInvite(w http.ResponseWriter, r *http.Request) {
	var req domain.AcceptFamilyInviteRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	token := strings.TrimSpace(req.Token)
	if token == "" {
		writeError(w, http.StatusBadRequest, "Einladung fehlt.")
		return
	}
	targetFamilyID, err := h.repo.InviteTargetFamily(r, token)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusForbidden, "Einladung ist ungueltig oder abgelaufen.")
		return
	}
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	targetProfile, err := h.repo.GetProfileByFamily(r, targetFamilyID)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	incomingProfile, err := h.repo.GetProfile(r)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	if h.promptDebug {
		_ = h.repo.SavePromptDebug(r, domain.PromptDebugEntry{
			Operation: "merge_profile",
			Model:     "mealplanner",
			Prompt:    h.planner.PreviewMergePrompt(targetProfile, incomingProfile),
			Meta: map[string]string{
				"promptVersion":   "2026-04-21",
				"targetMembers":   fmt.Sprintf("%d", len(targetProfile.Members)),
				"incomingMembers": fmt.Sprintf("%d", len(incomingProfile.Members)),
			},
		})
	}
	merged, err := h.planner.MergeProfiles(r.Context(), targetProfile, incomingProfile)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	family, err := h.repo.AcceptFamilyInvite(r, token, merged)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusForbidden, "Einladung ist ungueltig oder abgelaufen.")
		return
	}
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, family)
}

func (h *Handler) updateFamilyMemberLink(w http.ResponseWriter, r *http.Request) {
	var req domain.UpdateFamilyMemberLinkRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.AccountUserID) == "" {
		writeError(w, http.StatusBadRequest, "Account fehlt.")
		return
	}
	family, err := h.repo.UpdateFamilyMemberLink(r, strings.TrimSpace(req.AccountUserID), strings.TrimSpace(req.MemberID))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "Familienkonto-Zuordnung nicht gefunden.")
		return
	}
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, family)
}

func (h *Handler) getFavorites(w http.ResponseWriter, r *http.Request) {
	favorites, err := h.repo.ListFavorites(r)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, favorites)
}

func (h *Handler) createFavorite(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateFavoriteRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.Meal.Title) == "" {
		writeError(w, http.StatusBadRequest, "Favorit braucht ein Rezept.")
		return
	}
	favorite, err := h.repo.SaveFavorite(r, req.Meal)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, favorite)
}

func (h *Handler) deleteFavorite(w http.ResponseWriter, r *http.Request) {
	err := h.repo.DeleteFavorite(r, r.PathValue("favoriteID"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "favorite not found")
		return
	}
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) getLatestPromptDebug(w http.ResponseWriter, r *http.Request) {
	if !h.promptDebug {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	recent, err := h.repo.ListPromptDebug(r, 5)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		h.serverError(w, r, err)
		return
	}
	var latest *domain.PromptDebugEntry
	if len(recent) > 0 {
		entry := recent[0]
		latest = &entry
	}
	if latest == nil {
		entry, latestErr := h.repo.LatestPromptDebug(r)
		if latestErr == nil {
			latest = &entry
			recent = []domain.PromptDebugEntry{entry}
		} else if !errors.Is(latestErr, store.ErrNotFound) {
			h.serverError(w, r, latestErr)
			return
		}
	}
	if latest == nil {
		writeError(w, http.StatusNotFound, "prompt not found")
		return
	}
	requests, tokens := provider.OpenAIMetricsSnapshot()
	response := domain.PromptDebugSnapshot{
		Latest: latest,
		Recent: recent,
		OpenAI: domain.PromptDebugOpenAIData{
			Requests: make([]domain.OpenAIRequestMetric, 0, len(requests)),
			Tokens:   make([]domain.OpenAITokenMetric, 0, len(tokens)),
		},
	}
	for _, metric := range requests {
		response.OpenAI.Requests = append(response.OpenAI.Requests, domain.OpenAIRequestMetric{
			Operation:   metric.Operation,
			Model:       metric.Model,
			Status:      metric.Status,
			Count:       metric.Count,
			DurationSum: metric.DurationSum,
		})
	}
	for _, metric := range tokens {
		response.OpenAI.Tokens = append(response.OpenAI.Tokens, domain.OpenAITokenMetric{
			Operation: metric.Operation,
			Model:     metric.Model,
			Type:      metric.Type,
			Count:     metric.Count,
		})
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) createPlan(w http.ResponseWriter, r *http.Request) {
	var req domain.CreatePlanRequest
	if r.Body != nil && r.ContentLength != 0 {
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	profile, err := h.repo.GetProfile(r)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	favorites, err := h.repo.ListFavorites(r)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	if h.promptDebug {
		if prompt, err := h.planner.PreviewWeekPrompt(profile, req.WeekStart, favorites); err == nil {
			_ = h.repo.SavePromptDebug(r, domain.PromptDebugEntry{
				Operation: "generate_week",
				Model:     "mealplanner",
				Prompt:    prompt,
				Meta: map[string]string{
					"promptVersion":      "2026-04-21",
					"requestedWeekStart": strings.TrimSpace(req.WeekStart),
					"members":            fmt.Sprintf("%d", len(profile.Members)),
					"favorites":          fmt.Sprintf("%d", len(favorites)),
				},
			})
		}
	}
	plan, err := h.planner.GenerateWeek(r.Context(), profile, req.WeekStart, favorites)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	saved, err := h.repo.SavePlan(r, plan)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, saved)
}

func (h *Handler) createPlansForAllUsers(w http.ResponseWriter, r *http.Request) {
	userIDs, err := h.repo.ListUserIDs(r)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	var created []string
	var failures []map[string]string
	for _, userID := range userIDs {
		req := withUserID(r, userID)
		profile, err := h.repo.GetProfile(req)
		if err != nil {
			failures = append(failures, map[string]string{"userID": userID, "error": err.Error()})
			continue
		}
		favorites, err := h.repo.ListFavorites(req)
		if err != nil {
			failures = append(failures, map[string]string{"userID": userID, "error": err.Error()})
			continue
		}
		plan, err := h.planner.GenerateWeek(req.Context(), profile, "", favorites)
		if err != nil {
			failures = append(failures, map[string]string{"userID": userID, "error": err.Error()})
			continue
		}
		saved, err := h.repo.SavePlan(req, plan)
		if err != nil {
			failures = append(failures, map[string]string{"userID": userID, "error": err.Error()})
			continue
		}
		created = append(created, saved.ID)
	}
	status := http.StatusCreated
	if len(failures) > 0 {
		status = http.StatusMultiStatus
	}
	writeJSON(w, status, map[string]any{
		"created":  created,
		"failures": failures,
		"users":    len(userIDs),
	})
}

func (h *Handler) getCurrentPlan(w http.ResponseWriter, r *http.Request) {
	plan, err := h.repo.GetCurrentPlan(r)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "no plan exists yet")
		return
	}
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, plan)
}

func (h *Handler) getShoppingList(w http.ResponseWriter, r *http.Request) {
	plan, err := h.repo.GetPlan(r, r.PathValue("planID"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "plan not found")
		return
	}
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, domain.ConsolidateShoppingList(plan))
}

func (h *Handler) regenerateMeal(w http.ResponseWriter, r *http.Request) {
	var req domain.RegenerateMealRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	profile, err := h.repo.GetProfile(r)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	plan, err := h.repo.GetPlan(r, r.PathValue("planID"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "plan not found")
		return
	}
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	favorites, err := h.repo.ListFavorites(r)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	if h.promptDebug {
		_ = h.repo.SavePromptDebug(r, domain.PromptDebugEntry{
			Operation: "regenerate_meal",
			Model:     "mealplanner",
			Prompt:    h.planner.PreviewRegeneratePrompt(profile, plan, r.PathValue("mealID"), req.Note, favorites),
			Meta: map[string]string{
				"promptVersion": "2026-04-21",
				"mealID":        r.PathValue("mealID"),
				"noteProvided":  fmt.Sprintf("%t", strings.TrimSpace(req.Note) != ""),
				"favorites":     fmt.Sprintf("%d", len(favorites)),
				"existingMeals": fmt.Sprintf("%d", countMeals(plan)),
			},
		})
	}
	updated, err := h.planner.RegenerateMeal(r.Context(), profile, plan, r.PathValue("mealID"), req.Note, favorites)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	saved, err := h.repo.SavePlan(r, updated)
	if err != nil {
		h.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (h *Handler) withAPI(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !configuredSecret(h.apiSecret) {
			writeError(w, http.StatusServiceUnavailable, "internal api secret is not configured")
			return
		}
		token := strings.TrimSpace(r.Header.Get("X-API-Secret"))
		if token == "" {
			token = strings.TrimPrefix(strings.TrimSpace(r.Header.Get("Authorization")), "Bearer ")
		}
		if subtle.ConstantTimeCompare([]byte(token), []byte(h.apiSecret)) != 1 {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r)
	}
}

func (h *Handler) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if originAllowed(origin, h.corsOrigins) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Secret, X-CSRF-Token")
			w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) withRequestContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := requestIDFromContext(r.Context())
		if requestID == "" {
			requestID = newRequestID()
			r = r.WithContext(context.WithValue(r.Context(), requestIDKey, requestID))
		}
		w.Header().Set("X-Request-Id", requestID)
		start := time.Now()
		recorder := &accessStatusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		h.logger.Info("http request",
			"request_id", requestID,
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.status,
			"duration_ms", time.Since(start).Milliseconds(),
		)
	})
}

func (h *Handler) withRecover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				err := fmt.Errorf("panic: %v", recovered)
				h.serverError(w, r, err)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) withRateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !shouldRateLimit(r) {
			next.ServeHTTP(w, r)
			return
		}
		client := clientKey(r)
		if client == "" {
			client = "unknown"
		}
		key := client + ":" + r.Method + ":" + r.URL.Path
		if !h.rateLimiter.Allow(key) {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{
				"error": "Zu viele Anfragen in kurzer Zeit. Bitte versuche es gleich erneut.",
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func originAllowed(origin string, allowed []string) bool {
	if origin == "" || len(allowed) == 0 {
		return false
	}
	for _, candidate := range allowed {
		if candidate == origin {
			return true
		}
	}
	return false
}

func countMeals(plan domain.Plan) int {
	total := 0
	for _, day := range plan.Days {
		total += len(day.Meals)
	}
	return total
}

func (h *Handler) serverError(w http.ResponseWriter, r *http.Request, err error) {
	requestID := requestIDFromContext(r.Context())
	if requestID == "" {
		requestID = newRequestID()
	}
	h.logger.Error("api error", "request_id", requestID, "error", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{
		"error":     "Das hat gerade nicht geklappt. Bitte versuche es erneut.",
		"requestId": requestID,
	})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxJSONBodyBytes))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func withUserID(r *http.Request, userID string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), userIDKey, userID))
}

func configuredSecret(value string) bool {
	value = strings.TrimSpace(value)
	return value != "" && !strings.HasPrefix(value, "__set_")
}

const requestIDKey contextKey = "request_id"

type accessStatusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *accessStatusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

type rateLimiter struct {
	limit    int
	window   time.Duration
	mu       sync.Mutex
	requests map[string][]time.Time
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	if limit <= 0 {
		limit = 60
	}
	if window <= 0 {
		window = time.Minute
	}
	return &rateLimiter{limit: limit, window: window, requests: map[string][]time.Time{}}
}

func (l *rateLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	cutoff := now.Add(-l.window)
	values := l.requests[key]
	kept := values[:0]
	for _, value := range values {
		if value.After(cutoff) {
			kept = append(kept, value)
		}
	}
	if len(kept) >= l.limit {
		l.requests[key] = kept
		return false
	}
	l.requests[key] = append(kept, now)
	return true
}

func shouldRateLimit(r *http.Request) bool {
	if strings.HasPrefix(r.URL.Path, "/api/auth/") {
		return true
	}
	if strings.HasPrefix(r.URL.Path, "/api/family/invites") {
		return true
	}
	if strings.HasPrefix(r.URL.Path, "/api/plans") && r.Method == http.MethodPost {
		return true
	}
	return false
}

func clientKey(r *http.Request) string {
	forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwarded != "" {
		return strings.Split(forwarded, ",")[0]
	}
	host := strings.TrimSpace(r.RemoteAddr)
	if index := strings.LastIndex(host, ":"); index > 0 {
		return host[:index]
	}
	return host
}

func newRequestID() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%x", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}

func requestIDFromContext(ctx context.Context) string {
	value, _ := ctx.Value(requestIDKey).(string)
	return value
}

func getenv(key string) string {
	return os.Getenv(key)
}

func rateLimitFromEnv() int {
	value := strings.TrimSpace(getenv("RATE_LIMIT_REQUESTS_PER_MINUTE"))
	if value == "" {
		return 60
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 60
	}
	return parsed
}
