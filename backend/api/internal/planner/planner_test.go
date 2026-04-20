package planner

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
)

type fakeGenerator struct{}

func (fakeGenerator) GenerateWeek(context.Context, domain.Profile, time.Time) (domain.Plan, error) {
	return domain.Plan{ID: "plan-1", Days: []domain.DayPlan{{Date: "2026-04-20", Meals: []domain.Meal{{ID: "meal-1", Slot: "breakfast", Ingredients: []domain.Ingredient{{Name: "Hafer", Amount: 100, Unit: "g"}}}}}}}, nil
}

func (fakeGenerator) RegenerateMeal(_ context.Context, _ domain.Profile, _ domain.Plan, mealID string, note string) (domain.Meal, error) {
	return domain.Meal{ID: mealID, Slot: "breakfast", Title: "Neu", RegenerationNote: note, Ingredients: []domain.Ingredient{{Name: "Joghurt", Amount: 500, Unit: "g"}}}, nil
}

func TestGenerateWeekUsesExplicitWeekMonday(t *testing.T) {
	p := New(fakeGenerator{})
	plan, err := p.GenerateWeek(context.Background(), domain.DefaultProfile(), "2026-04-22")
	if err != nil {
		t.Fatal(err)
	}
	if plan.WeekStart != "2026-04-20" {
		t.Fatalf("expected monday week start, got %s", plan.WeekStart)
	}
	if len(plan.ShoppingList) != 1 {
		t.Fatalf("expected shopping list")
	}
}

func TestRegenerateMealReplacesMealAndStoresNote(t *testing.T) {
	p := New(fakeGenerator{})
	plan := domain.Plan{ID: "plan-1", Days: []domain.DayPlan{{Meals: []domain.Meal{{ID: "meal-1", Slot: "breakfast"}}}}}
	updated, err := p.RegenerateMeal(context.Background(), domain.DefaultProfile(), plan, "meal-1", "ohne Tomaten")
	if err != nil {
		t.Fatal(err)
	}
	if updated.Days[0].Meals[0].Title != "Neu" {
		t.Fatalf("meal not replaced")
	}
	if !strings.Contains(updated.Days[0].Meals[0].RegenerationNote, "Tomaten") {
		t.Fatalf("note not kept")
	}
}

func TestWeekPromptIncludesMinimizedProfile(t *testing.T) {
	prompt := WeekPrompt(domain.DefaultProfile(), time.Date(2026, 4, 19, 0, 0, 0, 0, time.UTC))
	if strings.Contains(prompt, "Familie Hartmann") || strings.Contains(prompt, `"name"`) {
		t.Fatalf("prompt should not include personal profile names: %s", prompt)
	}
	if !strings.Contains(prompt, "privater Haushalt") || !strings.Contains(prompt, "familientauglich") {
		t.Fatalf("prompt should include minimized meal planning profile: %s", prompt)
	}
}

func TestNormalizeDaysKeepsExactlySevenDays(t *testing.T) {
	start := time.Date(2026, 4, 19, 0, 0, 0, 0, time.UTC)
	days := []domain.DayPlan{
		{Date: "2026-04-19", Label: "Start"},
		{Date: "2026-04-20"},
		{Date: "2026-04-21"},
		{Date: "2026-04-22"},
		{Date: "2026-04-23"},
		{Date: "2026-04-24"},
		{Date: "2026-04-25"},
		{Date: "2026-04-26", Label: "Extra"},
	}
	got := normalizeDays(days, start)
	if len(got) != 7 {
		t.Fatalf("expected 7 days, got %d", len(got))
	}
	if got[0].Date != "2026-04-19" || got[6].Date != "2026-04-25" {
		t.Fatalf("unexpected range: %s to %s", got[0].Date, got[6].Date)
	}
}
