package store

import (
	"context"
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
	if len(migrations) != 2 {
		t.Fatalf("expected two migrations, got %d", len(migrations))
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
	userID, err := s.UpsertUser(ctx, "google", "store-test-subject")
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
