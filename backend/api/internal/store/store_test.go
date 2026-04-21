package store

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestLoadMigrations(t *testing.T) {
	migrations, err := loadMigrations()
	if err != nil {
		t.Fatal(err)
	}
	if len(migrations) != 3 {
		t.Fatalf("expected three migrations, got %d", len(migrations))
	}
}

func TestStoreRoundtrip(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := MigrateUp(ctx, pool); err != nil {
		t.Fatal(err)
	}
	s := New(pool)
	userID, err := s.UpsertUser(ctx, "google", "store-test-subject", "email-hash")
	if err != nil {
		t.Fatal(err)
	}
	profile, err := s.SaveProfile(ctx, userID, domain.DefaultProfile())
	if err != nil {
		t.Fatal(err)
	}
	if profile.UpdatedAt.IsZero() {
		t.Fatalf("expected updated timestamp")
	}
	plan := domain.Plan{ID: "plan-test", WeekStart: "2026-04-20", Status: "planned"}
	if _, err := s.SavePlan(ctx, userID, plan); err != nil {
		t.Fatal(err)
	}
	got, err := s.GetCurrentPlan(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(got.ID, "-plan-test") {
		t.Fatalf("expected scoped plan-test id, got %s", got.ID)
	}
}

func TestScopedPlanID(t *testing.T) {
	got := scopedPlanID("12345678-1234-1234-1234-123456789abc", "plan-2026")
	if got != "123456781234-plan-2026" {
		t.Fatalf("unexpected scoped plan id %q", got)
	}
	if scopedPlanID("12345678-1234-1234-1234-123456789abc", got) != got {
		t.Fatal("expected already scoped plan id to stay stable")
	}
}

func TestDecodePlan(t *testing.T) {
	raw, err := json.Marshal(domain.Plan{ID: "plan-1", WeekStart: "2026-04-20"})
	if err != nil {
		t.Fatal(err)
	}
	plan, err := decodePlan(raw)
	if err != nil {
		t.Fatal(err)
	}
	if plan.ID != "plan-1" || plan.WeekStart != "2026-04-20" {
		t.Fatalf("unexpected plan: %+v", plan)
	}
}

func TestRandomToken(t *testing.T) {
	token, err := randomToken(32)
	if err != nil {
		t.Fatal(err)
	}
	if len(token) < 32 {
		t.Fatalf("token too short: %q", token)
	}
}
