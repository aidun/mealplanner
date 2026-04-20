package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/auth"
	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/aidun/mealplanner/backend/api/internal/planner"
	"github.com/aidun/mealplanner/backend/api/internal/provider"
	"github.com/aidun/mealplanner/backend/api/internal/store"
)

type memoryRepo struct {
	profiles map[string]domain.Profile
	plans    map[string]domain.Plan
	sessions map[string]memorySession
}

type memorySession struct {
	userID    string
	csrf      string
	expiresAt time.Time
}

func newMemoryRepo() *memoryRepo {
	return &memoryRepo{
		profiles: map[string]domain.Profile{},
		plans:    map[string]domain.Plan{},
		sessions: map[string]memorySession{},
	}
}

func (m *memoryRepo) UpsertUser(_ *http.Request, _, _ string) (string, error) {
	return "user-1", nil
}

func (m *memoryRepo) CreateSession(_ *http.Request, userID string, ttl time.Duration) (string, string, time.Time, error) {
	sessionID := "session-" + userID
	csrf := "csrf-" + userID
	expiresAt := time.Now().Add(ttl)
	m.sessions[sessionID] = memorySession{userID: userID, csrf: csrf, expiresAt: expiresAt}
	return sessionID, csrf, expiresAt, nil
}

func (m *memoryRepo) GetSession(_ *http.Request, sessionID string) (string, string, time.Time, error) {
	session, ok := m.sessions[sessionID]
	if !ok || time.Now().After(session.expiresAt) {
		return "", "", time.Time{}, store.ErrNotFound
	}
	return session.userID, session.csrf, session.expiresAt, nil
}

func (m *memoryRepo) DeleteSession(_ *http.Request, sessionID string) error {
	delete(m.sessions, sessionID)
	return nil
}

func (m *memoryRepo) ListUserIDs(_ *http.Request) ([]string, error) {
	seen := map[string]bool{}
	var ids []string
	for userID := range m.profiles {
		seen[userID] = true
		ids = append(ids, userID)
	}
	for _, session := range m.sessions {
		if !seen[session.userID] {
			ids = append(ids, session.userID)
		}
	}
	return ids, nil
}

func (m *memoryRepo) GetProfile(r *http.Request) (domain.Profile, error) {
	userID := mustUserID(r.Context())
	if m.profiles[userID].HouseholdName == "" {
		return domain.DefaultProfile(), nil
	}
	return m.profiles[userID], nil
}

func (m *memoryRepo) SaveProfile(r *http.Request, profile domain.Profile) (domain.Profile, error) {
	m.profiles[mustUserID(r.Context())] = profile
	return profile, nil
}

func (m *memoryRepo) SavePlan(r *http.Request, plan domain.Plan) (domain.Plan, error) {
	m.plans[mustUserID(r.Context())+"|"+plan.ID] = plan
	return plan, nil
}

func (m *memoryRepo) GetCurrentPlan(r *http.Request) (domain.Plan, error) {
	prefix := mustUserID(r.Context()) + "|"
	for key, plan := range m.plans {
		if strings.HasPrefix(key, prefix) {
			return plan, nil
		}
	}
	return domain.Plan{}, store.ErrNotFound
}

func (m *memoryRepo) GetPlan(r *http.Request, id string) (domain.Plan, error) {
	plan, ok := m.plans[mustUserID(r.Context())+"|"+id]
	if !ok {
		return domain.Plan{}, store.ErrNotFound
	}
	return plan, nil
}

func (m *memoryRepo) GetPlanByID(_ *http.Request, id string) (domain.Plan, error) {
	for key, plan := range m.plans {
		if strings.HasSuffix(key, "|"+id) {
			return plan, nil
		}
	}
	return domain.Plan{}, store.ErrNotFound
}

func TestCreatePlanAndShoppingList(t *testing.T) {
	repo := newMemoryRepo()
	repo.profiles["user-1"] = domain.DefaultProfile()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil)

	body := bytes.NewBufferString(`{"weekStart":"2026-04-20"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/plans", body)
	setAuth(repo, req, "user-1")
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
	setAuth(repo, req, "user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestSessionRequired(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/profile", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestBringExport(t *testing.T) {
	repo := newMemoryRepo()
	repo.plans["user-1|plan-1"] = domain.Plan{
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
	}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if contentType := rec.Header().Get("Content-Type"); !strings.Contains(contentType, "text/html") {
		t.Fatalf("expected text/html content type, got %q", contentType)
	}
	body := rec.Body.String()
	for _, expected := range []string{"schema.org", `"@type":"Recipe"`, "recipeIngredient", `"author":"Mealplanner"`, `"prepTime":"PT10M"`, `"totalTime":"PT10M"`, "itemtype=\"https://schema.org/Recipe\"", "itemprop=\"recipeIngredient\"", "itemprop=\"author\"", "itemprop=\"recipeInstructions\"", "platform.getbring.com/widgets/import.js", "data-bring-import", "2 Stk Zucchini", "400 g Pasta"} {
		if !strings.Contains(body, expected) {
			t.Fatalf("bring export missing %q in body: %s", expected, body)
		}
	}

	req = httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export-url", nil)
	req.Host = "mealplanner.test"
	req.Header.Set("X-Forwarded-Proto", "https")
	setAuth(repo, req, "user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected signed url 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var payload map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(payload["url"], "https://mealplanner.test/api/plans/plan-1/bring-export?token=") {
		t.Fatalf("unexpected signed url %q", payload["url"])
	}

	req = httptest.NewRequest(http.MethodGet, payload["url"], nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected public signed export 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestBringExportPlanNotFound(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/plans/missing/bring-export", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestMetricsEndpoint(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil)
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

func TestMutatingRequestRequiresCSRF(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/plans", bytes.NewBufferString(`{}`))
	repo.sessions["session-user-1"] = memorySession{userID: "user-1", csrf: "csrf-user-1", expiresAt: time.Now().Add(time.Hour)}
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: "session-user-1"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestCORSAllowsCSRFCredentials(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), testAuth(), "", []string{"http://localhost:4173"}, nil)
	req := httptest.NewRequest(http.MethodOptions, "/api/profile", nil)
	req.Header.Set("Origin", "http://localhost:4173")
	req.Header.Set("Access-Control-Request-Method", "PUT")
	req.Header.Set("Access-Control-Request-Headers", "Content-Type, X-CSRF-Token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Fatalf("expected credentials true, got %q", got)
	}
	if headers := rec.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(headers, "X-CSRF-Token") {
		t.Fatalf("expected csrf header to be allowed, got %q", headers)
	}
}

func TestCORSRejectsWildcardForCredentialedRequests(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), testAuth(), "", []string{"*"}, nil)
	req := httptest.NewRequest(http.MethodOptions, "/api/profile", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected wildcard CORS to be ignored for credentials, got %q", got)
	}
}

func TestSecurityHeadersAndJSONBodyLimit(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil)
	req := httptest.NewRequest(http.MethodPut, "/api/profile", strings.NewReader(strings.Repeat("x", maxJSONBodyBytes+1)))
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for oversized json body, got %d", rec.Code)
	}
	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("expected nosniff header, got %q", got)
	}
}

func TestInternalWeeklyPlanUsesAPISecret(t *testing.T) {
	repo := newMemoryRepo()
	repo.profiles["user-1"] = domain.DefaultProfile()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "internal-secret", nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/internal/plans/weekly", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without internal secret, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/internal/plans/weekly", nil)
	req.Header.Set("X-API-Secret", "internal-secret")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 with internal secret, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"users":1`) {
		t.Fatalf("unexpected weekly response: %s", rec.Body.String())
	}
}

func TestSessionEndpoint(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"authenticated":true`) || !strings.Contains(rec.Body.String(), "csrf-user-1") {
		t.Fatalf("unexpected session response: %s", rec.Body.String())
	}
}

func TestAuthProvidersEndpoint(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), configuredTestAuth(), "", nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/providers", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"id":"google"`) || !strings.Contains(rec.Body.String(), `"startUrl":"/api/auth/google/start"`) {
		t.Fatalf("unexpected providers response: %s", rec.Body.String())
	}
}

func TestGoogleStartSetsSecureStateCookie(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), configuredTestAuth(), "", nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/start", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusFound {
		t.Fatalf("expected 302, got %d: %s", rec.Code, rec.Body.String())
	}
	if location := rec.Header().Get("Location"); !strings.HasPrefix(location, "https://accounts.google.com/o/oauth2/v2/auth?") {
		t.Fatalf("unexpected google redirect location %q", location)
	}
	var stateCookie *http.Cookie
	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == auth.StateCookieName {
			stateCookie = cookie
			break
		}
	}
	if stateCookie == nil {
		t.Fatal("expected oauth state cookie")
	}
	if !stateCookie.HttpOnly || !stateCookie.Secure || stateCookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("state cookie is not hardened: %+v", stateCookie)
	}
}

func TestLogoutDeletesSessionAndClearsSecureCookie(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if _, ok := repo.sessions["session-user-1"]; ok {
		t.Fatal("expected session to be deleted")
	}
	var sessionCookie *http.Cookie
	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == auth.SessionCookieName {
			sessionCookie = cookie
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected cleared session cookie")
	}
	if sessionCookie.MaxAge != -1 || !sessionCookie.HttpOnly || !sessionCookie.Secure || sessionCookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("session cookie is not cleared securely: %+v", sessionCookie)
	}
}

func TestBringExportURLUsesConfiguredBaseURL(t *testing.T) {
	repo := newMemoryRepo()
	repo.plans["user-1|plan-1"] = domain.Plan{ID: "plan-1", WeekStart: "2026-04-20"}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export-url", nil)
	req.Host = "attacker.example"
	req.Header.Set("X-Forwarded-Host", "attacker.example")
	req.Header.Set("X-Forwarded-Proto", "http")
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var payload map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(payload["url"], "https://mealplanner.test/api/plans/plan-1/bring-export?token=") {
		t.Fatalf("unexpected export url %q", payload["url"])
	}
	if strings.Contains(payload["url"], "attacker.example") {
		t.Fatalf("export url trusted spoofed host: %q", payload["url"])
	}
}

func testAuth() auth.Service {
	return auth.NewService(auth.Config{
		BaseURL:       "https://mealplanner.test",
		SessionSecret: "test-secret",
	})
}

func configuredTestAuth() auth.Service {
	return auth.NewService(auth.Config{
		BaseURL:            "https://mealplanner.test",
		SessionSecret:      "test-secret",
		GoogleClientID:     "google-client",
		GoogleClientSecret: "google-secret",
	})
}

func setAuth(repo *memoryRepo, req *http.Request, userID string) {
	repo.sessions["session-"+userID] = memorySession{userID: userID, csrf: "csrf-" + userID, expiresAt: time.Now().Add(time.Hour)}
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: "session-" + userID})
	req.Header.Set("X-CSRF-Token", "csrf-"+userID)
}
