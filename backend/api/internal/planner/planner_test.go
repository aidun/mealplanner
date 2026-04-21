package planner

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
)

type fakeGenerator struct{}

func (fakeGenerator) GenerateWeek(context.Context, domain.Profile, time.Time, []domain.FavoriteRecipe) (domain.Plan, error) {
	return domain.Plan{ID: "plan-1", Days: []domain.DayPlan{{Date: "2026-04-20", Meals: []domain.Meal{{ID: "meal-1", Slot: "breakfast", Ingredients: []domain.Ingredient{{Name: "Hafer", Amount: 100, Unit: "g"}}}}}}}, nil
}

func (fakeGenerator) RegenerateMeal(_ context.Context, _ domain.Profile, _ domain.Plan, mealID string, note string, _ []domain.FavoriteRecipe) (domain.Meal, error) {
	return domain.Meal{ID: mealID, Slot: "breakfast", Title: "Neu", RegenerationNote: note, Ingredients: []domain.Ingredient{{Name: "Joghurt", Amount: 500, Unit: "g"}}}, nil
}

func (fakeGenerator) MergeProfiles(_ context.Context, target domain.Profile, incoming domain.Profile) (domain.Profile, error) {
	target.Members = append(target.Members, incoming.Members...)
	return target, nil
}

type fakeGeneratorWithFavoriteMatch struct{}

func (fakeGeneratorWithFavoriteMatch) GenerateWeek(context.Context, domain.Profile, time.Time, []domain.FavoriteRecipe) (domain.Plan, error) {
	return domain.Plan{ID: "plan-1", Days: []domain.DayPlan{{Date: "2026-04-20", Meals: []domain.Meal{{ID: "meal-1", Slot: "breakfast", Title: "Lieblings Porridge", Ingredients: []domain.Ingredient{{Name: "Hafer", Amount: 100, Unit: "g"}}}}}}}, nil
}

func (fakeGeneratorWithFavoriteMatch) RegenerateMeal(_ context.Context, _ domain.Profile, _ domain.Plan, mealID string, note string, _ []domain.FavoriteRecipe) (domain.Meal, error) {
	return domain.Meal{ID: mealID, Slot: "breakfast", Title: "Neu", RegenerationNote: note, Ingredients: []domain.Ingredient{{Name: "Joghurt", Amount: 500, Unit: "g"}}}, nil
}

func (fakeGeneratorWithFavoriteMatch) MergeProfiles(_ context.Context, target domain.Profile, incoming domain.Profile) (domain.Profile, error) {
	target.Members = append(target.Members, incoming.Members...)
	return target, nil
}

type fakeGeneratorWithNutritionDrift struct{}

func (fakeGeneratorWithNutritionDrift) GenerateWeek(context.Context, domain.Profile, time.Time, []domain.FavoriteRecipe) (domain.Plan, error) {
	return domain.Plan{ID: "plan-1", Days: []domain.DayPlan{{Date: "2026-04-20", Meals: []domain.Meal{{
		ID:                 "meal-1",
		Slot:               "dinner",
		Title:              "Pasta",
		Description:        "",
		Ingredients:        []domain.Ingredient{{Name: "Pasta", Amount: 400, Unit: "g"}, {Name: " ", Amount: 10, Unit: "g"}},
		Instructions:       []string{" ", "Kochen"},
		Nutrition:          domain.Nutrition{Calories: 100, ProteinG: 20, CarbsG: 50, FatG: 10, FiberG: 80},
		EstimatedNutrition: true,
	}}}}}, nil
}

func (fakeGeneratorWithNutritionDrift) RegenerateMeal(context.Context, domain.Profile, domain.Plan, string, string, []domain.FavoriteRecipe) (domain.Meal, error) {
	return domain.Meal{}, nil
}

func (fakeGeneratorWithNutritionDrift) MergeProfiles(_ context.Context, target domain.Profile, incoming domain.Profile) (domain.Profile, error) {
	target.Members = append(target.Members, incoming.Members...)
	return target, nil
}

type fakeGeneratorWithVariantMatch struct{}

func (fakeGeneratorWithVariantMatch) GenerateWeek(context.Context, domain.Profile, time.Time, []domain.FavoriteRecipe) (domain.Plan, error) {
	return domain.Plan{}, nil
}

func (fakeGeneratorWithVariantMatch) RegenerateMeal(_ context.Context, _ domain.Profile, _ domain.Plan, mealID string, note string, _ []domain.FavoriteRecipe) (domain.Meal, error) {
	return domain.Meal{ID: mealID, Slot: "dinner", Title: "Cremige Pasta", RegenerationNote: note, Ingredients: []domain.Ingredient{{Name: "Pasta", Amount: 500, Unit: "g"}}}, nil
}

func (fakeGeneratorWithVariantMatch) MergeProfiles(_ context.Context, target domain.Profile, incoming domain.Profile) (domain.Profile, error) {
	target.Members = append(target.Members, incoming.Members...)
	return target, nil
}

func TestGenerateWeekUsesExplicitWeekMonday(t *testing.T) {
	p := New(fakeGenerator{})
	plan, err := p.GenerateWeek(context.Background(), domain.DefaultProfile(), "2026-04-22", nil)
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

func TestGenerateWeekMarksMealsReusedFromFavorites(t *testing.T) {
	p := New(fakeGeneratorWithFavoriteMatch{})
	plan, err := p.GenerateWeek(context.Background(), domain.DefaultProfile(), "2026-04-20", []domain.FavoriteRecipe{{
		Meal: domain.Meal{Title: "Lieblings Porridge"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if got := plan.Days[0].Meals[0].Meta["favoriteReuse"]; got != "direct" {
		t.Fatalf("expected direct favorite marker, got %#v", plan.Days[0].Meals[0].Meta)
	}
}

func TestRegenerateMealReplacesMealAndStoresNote(t *testing.T) {
	p := New(fakeGenerator{})
	plan := domain.Plan{ID: "plan-1", Days: []domain.DayPlan{{Meals: []domain.Meal{{ID: "meal-1", Slot: "breakfast"}}}}}
	updated, err := p.RegenerateMeal(context.Background(), domain.DefaultProfile(), plan, "meal-1", "ohne Tomaten", nil)
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

func TestRegenerateMealMarksFavoriteReuseOnMatch(t *testing.T) {
	p := New(fakeGenerator{})
	plan := domain.Plan{ID: "plan-1", Days: []domain.DayPlan{{Meals: []domain.Meal{{ID: "meal-1", Slot: "breakfast"}}}}}
	updated, err := p.RegenerateMeal(context.Background(), domain.DefaultProfile(), plan, "meal-1", "ohne Tomaten", []domain.FavoriteRecipe{{
		Meal: domain.Meal{Title: "Neu"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Days[0].Meals[0].Meta["favoriteReuse"] != "direct" {
		t.Fatalf("expected favorite marker on regenerated meal, got %#v", updated.Days[0].Meals[0].Meta)
	}
}

func TestGenerateWeekNormalizesNutritionAndMealPayload(t *testing.T) {
	p := New(fakeGeneratorWithNutritionDrift{})
	plan, err := p.GenerateWeek(context.Background(), domain.DefaultProfile(), "2026-04-20", nil)
	if err != nil {
		t.Fatal(err)
	}
	meal := plan.Days[0].Meals[0]
	if meal.Nutrition.Calories <= 0 {
		t.Fatalf("expected calories to be estimated, got %d", meal.Nutrition.Calories)
	}
	if meal.Nutrition.FiberG > meal.Nutrition.CarbsG {
		t.Fatalf("expected fiber to be clamped to carbs, got %+v", meal.Nutrition)
	}
	if len(meal.Ingredients) != 1 {
		t.Fatalf("expected empty ingredient rows to be removed, got %d", len(meal.Ingredients))
	}
	if len(meal.Instructions) != 1 || meal.Instructions[0] != "Kochen" {
		t.Fatalf("expected instructions to be normalized, got %#v", meal.Instructions)
	}
	if !strings.Contains(strings.Join(meal.Warnings, " "), "Zutaten") {
		t.Fatalf("expected nutrition estimate warning, got %#v", meal.Warnings)
	}
	if meal.Meta["nutritionSource"] == "" {
		t.Fatalf("expected nutrition source metadata, got %#v", meal.Meta)
	}
}

func TestFavoriteMatchMarksVariants(t *testing.T) {
	p := New(fakeGeneratorWithVariantMatch{})
	plan := domain.Plan{ID: "plan-1", Days: []domain.DayPlan{{Meals: []domain.Meal{{ID: "meal-1", Slot: "dinner"}}}}}
	updated, err := p.RegenerateMeal(context.Background(), domain.DefaultProfile(), plan, "meal-1", "familientauglich", []domain.FavoriteRecipe{{
		Meal: domain.Meal{Title: "Cremige Pasta Auflauf"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Days[0].Meals[0].Meta["favoriteReuse"] != "variant" {
		t.Fatalf("expected favorite variant marker, got %#v", updated.Days[0].Meals[0].Meta)
	}
}

func TestEstimateNutritionFromIngredients(t *testing.T) {
	meal := domain.Meal{
		Ingredients: []domain.Ingredient{
			{Name: "Pasta", Amount: 400, Unit: "g"},
			{Name: "Joghurt", Amount: 200, Unit: "g"},
			{Name: "Zucchini", Amount: 2, Unit: "Stk"},
		},
		Servings: []domain.Serving{
			{Name: "Anna", Factor: 1},
			{Name: "Ben", Factor: 1},
		},
	}
	nutrition, ok := estimateNutritionFromIngredients(meal)
	if !ok {
		t.Fatal("expected ingredient nutrition estimate")
	}
	if nutrition.Calories <= 0 || nutrition.ProteinG <= 0 || nutrition.CarbsG <= 0 {
		t.Fatalf("expected useful estimate, got %+v", nutrition)
	}
}

func TestWeekPromptIncludesMinimizedProfile(t *testing.T) {
	prompt := WeekPrompt(domain.DefaultProfile(), time.Date(2026, 4, 19, 0, 0, 0, 0, time.UTC), nil)
	if strings.Contains(prompt, "Familie Hartmann") || strings.Contains(prompt, `"name"`) {
		t.Fatalf("prompt should not include personal profile names: %s", prompt)
	}
	if !strings.Contains(prompt, "privater Haushalt") || !strings.Contains(prompt, "familientauglich") || !strings.Contains(prompt, `"alias": "Markus"`) {
		t.Fatalf("prompt should include minimized meal planning profile: %s", prompt)
	}
}

func TestGenerateWeekFiltersDisabledSlotsAndParticipants(t *testing.T) {
	profile := domain.DefaultProfile()
	profile.Members = []domain.Member{
		{ID: "markus", Name: "Markus", Alias: "Markus"},
		{ID: "alex", Name: "Alex", Alias: "Alex"},
	}
	profile.Notes = "Aktive Mahlzeiten:\nFrühstück\nAbendessen\n\nTeilnehmende Frühstück:\nMarkus\n\nTeilnehmende Abendessen:\nMarkus\nAlex"
	p := New(fakeGenerator{
	})
	plan, err := p.GenerateWeek(context.Background(), profile, "2026-04-20", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Days[0].Meals) != 1 {
		t.Fatalf("expected only enabled slot to remain in fake output, got %#v", plan.Days[0].Meals)
	}
	if got := len(plan.Days[0].Meals[0].Servings); got != 1 {
		t.Fatalf("expected servings to be limited to selected participants, got %#v", plan.Days[0].Meals[0].Servings)
	}
}

func TestWeekPromptIncludesMealPlanRules(t *testing.T) {
	profile := domain.DefaultProfile()
	profile.Members = []domain.Member{
		{ID: "markus", Name: "Markus", Alias: "Markus"},
		{ID: "alex", Name: "Alex", Alias: "Alex"},
	}
	profile.Notes = "Aktive Mahlzeiten:\nFrühstück\nAbendessen\n\nTeilnehmende Frühstück:\nMarkus\n\nTeilnehmende Abendessen:\nMarkus\nAlex"
	prompt := WeekPrompt(profile, time.Date(2026, 4, 19, 0, 0, 0, 0, time.UTC), nil)
	if !strings.Contains(prompt, "Frühstück, Abendessen") || !strings.Contains(prompt, "\"participants\": [") {
		t.Fatalf("expected meal plan rules in prompt, got %s", prompt)
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
