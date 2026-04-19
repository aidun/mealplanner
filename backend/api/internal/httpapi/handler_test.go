package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/aidun/mealplanner/backend/api/internal/planner"
	"github.com/aidun/mealplanner/backend/api/internal/provider"
	"github.com/aidun/mealplanner/backend/api/internal/store"
)

type memoryRepo struct {
	profile domain.Profile
	plan    domain.Plan
}

func (m *memoryRepo) GetProfile(*http.Request) (domain.Profile, error) {
	if m.profile.HouseholdName == "" {
		return domain.DefaultProfile(), nil
	}
	return m.profile, nil
}

func (m *memoryRepo) SaveProfile(_ *http.Request, profile domain.Profile) (domain.Profile, error) {
	m.profile = profile
	return profile, nil
}

func (m *memoryRepo) SavePlan(_ *http.Request, plan domain.Plan) (domain.Plan, error) {
	m.plan = plan
	return plan, nil
}

func (m *memoryRepo) GetCurrentPlan(*http.Request) (domain.Plan, error) {
	if m.plan.ID == "" {
		return domain.Plan{}, store.ErrNotFound
	}
	return m.plan, nil
}

func (m *memoryRepo) GetPlan(_ *http.Request, id string) (domain.Plan, error) {
	if m.plan.ID != id {
		return domain.Plan{}, store.ErrNotFound
	}
	return m.plan, nil
}

func TestCreatePlanAndShoppingList(t *testing.T) {
	repo := &memoryRepo{profile: domain.DefaultProfile()}
	handler := New(repo, planner.New(provider.NewMockGenerator()), "secret", nil, nil)

	body := bytes.NewBufferString(`{"weekStart":"2026-04-20"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/plans", body)
	req.Header.Set("X-API-Secret", "secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var plan domain.Plan
	if err := json.Unmarshal(rec.Body.Bytes(), &plan); err != nil {
		t.Fatal(err)
	}
	if len(plan.Days) != 7 {
		t.Fatalf("expected seven days, got %d", len(plan.Days))
	}

	req = httptest.NewRequest(http.MethodGet, "/api/plans/"+plan.ID+"/shopping-list", nil)
	req.Header.Set("X-API-Secret", "secret")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestAPISecretRequired(t *testing.T) {
	handler := New(&memoryRepo{}, planner.New(provider.NewMockGenerator()), "secret", nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/profile", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestBringExport(t *testing.T) {
	repo := &memoryRepo{plan: domain.Plan{
		ID:        "plan-1",
		WeekStart: "2026-04-20",
		Days: []domain.DayPlan{{
			Date: "2026-04-20",
			Meals: []domain.Meal{{
				ID:    "meal-1",
				Title: "Pasta",
				Ingredients: []domain.Ingredient{
					{Name: "Zucchini", Amount: 1, Unit: "Stk", Category: "Gemuese"},
					{Name: "Zucchini", Amount: 1, Unit: "Stk", Category: "Gemuese"},
					{Name: "Pasta", Amount: 400, Unit: "g", Category: "Vorrat"},
				},
			}},
		}},
	}}
	handler := New(repo, planner.New(provider.NewMockGenerator()), "secret", nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export", nil)
	req.Header.Set("X-API-Secret", "secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if contentType := rec.Header().Get("Content-Type"); !strings.Contains(contentType, "text/html") {
		t.Fatalf("expected text/html content type, got %q", contentType)
	}
	body := rec.Body.String()
	for _, expected := range []string{"schema.org", `"@type":"Recipe"`, "recipeIngredient", "2 Stk Zucchini", "400 g Pasta"} {
		if !strings.Contains(body, expected) {
			t.Fatalf("bring export missing %q in body: %s", expected, body)
		}
	}
}

func TestBringExportPlanNotFound(t *testing.T) {
	handler := New(&memoryRepo{}, planner.New(provider.NewMockGenerator()), "secret", nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/plans/missing/bring-export", nil)
	req.Header.Set("X-API-Secret", "secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestMetricsEndpoint(t *testing.T) {
	handler := New(&memoryRepo{}, planner.New(provider.NewMockGenerator()), "secret", nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	req = httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "mealplanner_http_requests_total") {
		t.Fatalf("metrics output missing request counter: %s", rec.Body.String())
	}
}
