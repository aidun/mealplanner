package httpapi

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/auth"
	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/aidun/mealplanner/backend/api/internal/planner"
	"github.com/aidun/mealplanner/backend/api/internal/store"
)

type Repository interface {
	UpsertUser(r *http.Request, provider, subjectHash string) (string, error)
	CreateSession(r *http.Request, userID string, ttl time.Duration) (string, string, time.Time, error)
	GetSession(r *http.Request, sessionID string) (string, string, time.Time, error)
	DeleteSession(r *http.Request, sessionID string) error
	ListUserIDs(r *http.Request) ([]string, error)
	GetProfile(r *http.Request) (domain.Profile, error)
	SaveProfile(r *http.Request, profile domain.Profile) (domain.Profile, error)
	SavePlan(r *http.Request, plan domain.Plan) (domain.Plan, error)
	GetCurrentPlan(r *http.Request) (domain.Plan, error)
	GetPlan(r *http.Request, id string) (domain.Plan, error)
	GetPlanByID(r *http.Request, id string) (domain.Plan, error)
}

type StoreRepository struct {
	Store store.Store
}

func (r StoreRepository) UpsertUser(req *http.Request, provider, subjectHash string) (string, error) {
	return r.Store.UpsertUser(req.Context(), provider, subjectHash)
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

type Handler struct {
	repo        Repository
	planner     planner.Planner
	auth        auth.Service
	metrics     *Metrics
	apiSecret   string
	corsOrigins []string
	logger      *slog.Logger
}

const maxJSONBodyBytes = 1 << 20

func New(repo Repository, planner planner.Planner, authService auth.Service, apiSecret string, corsOrigins []string, logger *slog.Logger) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	h := &Handler{repo: repo, planner: planner, auth: authService, metrics: NewMetrics(), apiSecret: strings.TrimSpace(apiSecret), corsOrigins: corsOrigins, logger: logger}
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
	mux.HandleFunc("POST /api/plans", h.withSession(h.withCSRF(h.createPlan)))
	mux.HandleFunc("GET /api/plans/current", h.withSession(h.getCurrentPlan))
	mux.HandleFunc("GET /api/plans/{planID}/bring-export", h.getBringExport)
	mux.HandleFunc("GET /api/plans/{planID}/bring-export-url", h.withSession(h.getBringExportURL))
	mux.HandleFunc("GET /api/plans/{planID}/shopping-list", h.withSession(h.getShoppingList))
	mux.HandleFunc("POST /api/plans/{planID}/meals/{mealID}/regenerate", h.withSession(h.withCSRF(h.regenerateMeal)))
	return h.metrics.Middleware(h.withSecurityHeaders(h.withCORS(mux)))
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) getProfile(w http.ResponseWriter, r *http.Request) {
	profile, err := h.repo.GetProfile(r)
	if err != nil {
		h.serverError(w, err)
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
		h.serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, saved)
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
		h.serverError(w, err)
		return
	}
	plan, err := h.planner.GenerateWeek(r.Context(), profile, req.WeekStart)
	if err != nil {
		h.serverError(w, err)
		return
	}
	saved, err := h.repo.SavePlan(r, plan)
	if err != nil {
		h.serverError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, saved)
}

func (h *Handler) createPlansForAllUsers(w http.ResponseWriter, r *http.Request) {
	userIDs, err := h.repo.ListUserIDs(r)
	if err != nil {
		h.serverError(w, err)
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
		plan, err := h.planner.GenerateWeek(req.Context(), profile, "")
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
		h.serverError(w, err)
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
		h.serverError(w, err)
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
		h.serverError(w, err)
		return
	}
	plan, err := h.repo.GetPlan(r, r.PathValue("planID"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "plan not found")
		return
	}
	if err != nil {
		h.serverError(w, err)
		return
	}
	updated, err := h.planner.RegenerateMeal(r.Context(), profile, plan, r.PathValue("mealID"), req.Note)
	if err != nil {
		h.serverError(w, err)
		return
	}
	saved, err := h.repo.SavePlan(r, updated)
	if err != nil {
		h.serverError(w, err)
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

func (h *Handler) serverError(w http.ResponseWriter, err error) {
	requestID := fmt.Sprintf("%x", time.Now().UnixNano())
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
