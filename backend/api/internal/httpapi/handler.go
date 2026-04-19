package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/aidun/mealplanner/backend/api/internal/planner"
	"github.com/aidun/mealplanner/backend/api/internal/store"
)

type Repository interface {
	GetProfile(r *http.Request) (domain.Profile, error)
	SaveProfile(r *http.Request, profile domain.Profile) (domain.Profile, error)
	SavePlan(r *http.Request, plan domain.Plan) (domain.Plan, error)
	GetCurrentPlan(r *http.Request) (domain.Plan, error)
	GetPlan(r *http.Request, id string) (domain.Plan, error)
}

type StoreRepository struct {
	Store store.Store
}

func (r StoreRepository) GetProfile(req *http.Request) (domain.Profile, error) {
	return r.Store.GetProfile(req.Context())
}

func (r StoreRepository) SaveProfile(req *http.Request, profile domain.Profile) (domain.Profile, error) {
	return r.Store.SaveProfile(req.Context(), profile)
}

func (r StoreRepository) SavePlan(req *http.Request, plan domain.Plan) (domain.Plan, error) {
	return r.Store.SavePlan(req.Context(), plan)
}

func (r StoreRepository) GetCurrentPlan(req *http.Request) (domain.Plan, error) {
	return r.Store.GetCurrentPlan(req.Context())
}

func (r StoreRepository) GetPlan(req *http.Request, id string) (domain.Plan, error) {
	return r.Store.GetPlan(req.Context(), id)
}

type Handler struct {
	repo        Repository
	planner     planner.Planner
	metrics     *Metrics
	apiSecret   string
	corsOrigins []string
	logger      *slog.Logger
}

func New(repo Repository, planner planner.Planner, apiSecret string, corsOrigins []string, logger *slog.Logger) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	h := &Handler{repo: repo, planner: planner, metrics: NewMetrics(), apiSecret: strings.TrimSpace(apiSecret), corsOrigins: corsOrigins, logger: logger}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", h.health)
	mux.Handle("GET /metrics", h.metrics)
	mux.HandleFunc("GET /api/profile", h.withAPI(h.getProfile))
	mux.HandleFunc("PUT /api/profile", h.withAPI(h.putProfile))
	mux.HandleFunc("POST /api/plans", h.withAPI(h.createPlan))
	mux.HandleFunc("GET /api/plans/current", h.withAPI(h.getCurrentPlan))
	mux.HandleFunc("GET /api/plans/{planID}/bring-export", h.withAPI(h.getBringExport))
	mux.HandleFunc("GET /api/plans/{planID}/shopping-list", h.withAPI(h.getShoppingList))
	mux.HandleFunc("POST /api/plans/{planID}/meals/{mealID}/regenerate", h.withAPI(h.regenerateMeal))
	return h.metrics.Middleware(h.withCORS(mux))
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
	if err := decodeJSON(r, &profile); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	saved, err := h.repo.SaveProfile(r, profile)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (h *Handler) createPlan(w http.ResponseWriter, r *http.Request) {
	var req domain.CreatePlanRequest
	if r.Body != nil && r.ContentLength != 0 {
		if err := decodeJSON(r, &req); err != nil {
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
	if err := decodeJSON(r, &req); err != nil {
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
		if h.apiSecret != "" {
			token := strings.TrimSpace(r.Header.Get("X-API-Secret"))
			if token == "" {
				token = strings.TrimPrefix(strings.TrimSpace(r.Header.Get("Authorization")), "Bearer ")
			}
			if token != h.apiSecret {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
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
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Secret")
			w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
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
		if candidate == "*" || candidate == origin {
			return true
		}
	}
	return false
}

func (h *Handler) serverError(w http.ResponseWriter, err error) {
	h.logger.Error("api error", "error", err)
	writeError(w, http.StatusInternalServerError, err.Error())
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(r.Body)
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
