package planner

import (
	"strings"
	"testing"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
)

func TestWeekPromptMinimizesPersonalLoginContext(t *testing.T) {
	profile := domain.Profile{
		HouseholdName: "Familie Hartmann",
		Members: []domain.Member{{
			ID:             "markus",
			Name:           "Markus Hartmann",
			Alias:          "Markus",
			Role:           "Vater",
			Age:            39,
			CaloriesTarget: 2300,
			Likes:          "frische Kueche",
			Restrictions:   "keine Erdnuesse",
		}},
		Notes: "Naehrwerte sind Schaetzungen.",
	}

	prompt := WeekPrompt(profile, time.Date(2026, 4, 20, 0, 0, 0, 0, time.UTC), nil)

	for _, forbidden := range []string{"Familie Hartmann", `"name"`, `"markus"`, "@gmail.com"} {
		if strings.Contains(prompt, forbidden) {
			t.Fatalf("prompt leaked personal profile value %q:\n%s", forbidden, prompt)
		}
	}
	for _, expected := range []string{`"household": "privater Haushalt"`, `"id": "person-1"`, `"alias": "Markus"`, `"ageGroup": "Erwachsen"`, "keine Erdnuesse"} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("prompt missing minimized value %q:\n%s", expected, prompt)
		}
	}
}

func TestRegeneratePromptDoesNotSendFullPlanOrServingNames(t *testing.T) {
	profile := domain.Profile{
		HouseholdName: "Familie Hartmann",
		Members:       []domain.Member{{ID: "alexandra", Name: "Alexandra Hartmann", Alias: "Alexandra"}},
	}
	plan := domain.Plan{
		ID:           "plan-1",
		WeekStart:    "2026-04-20",
		ShoppingList: []domain.ShoppingItem{{Name: "Pasta", Amount: 500, Unit: "g"}},
		Days: []domain.DayPlan{{
			Date: "2026-04-20",
			Meals: []domain.Meal{{
				ID:          "meal-1",
				Slot:        "dinner",
				Title:       "Pasta",
				Description: "Schnell",
				Servings:    []domain.Serving{{MemberID: "alexandra", Name: "Alexandra", Portion: "normal", Factor: 1}},
				Ingredients: []domain.Ingredient{{Name: "Tomaten", Amount: 2, Unit: "Stk"}},
			}},
		}},
	}

	prompt := RegeneratePrompt(profile, plan, "meal-1", "ohne Tomaten", nil)

	for _, forbidden := range []string{"Familie Hartmann", "shoppingList", "servings", "@gmail.com"} {
		if strings.Contains(prompt, forbidden) {
			t.Fatalf("regeneration prompt leaked full context value %q:\n%s", forbidden, prompt)
		}
	}
	for _, expected := range []string{`"targetMeal"`, `"existingMeals"`, `"alias": "Alexandra"`, "ohne Tomaten", "Pasta"} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("regeneration prompt missing expected context %q:\n%s", expected, prompt)
		}
	}
}

func TestWeekPromptIncludesFavoritesAsInspiration(t *testing.T) {
	prompt := WeekPrompt(domain.DefaultProfile(), time.Date(2026, 4, 20, 0, 0, 0, 0, time.UTC), []domain.FavoriteRecipe{{
		Meal: domain.Meal{Title: "Lieblingspasta", Slot: "dinner", Description: "Tomatig und schnell", Tags: []string{"favorit"}},
	}})

	if !strings.Contains(prompt, "Lieblingspasta") || !strings.Contains(prompt, "Favoriten") {
		t.Fatalf("prompt should include compact favorites: %s", prompt)
	}
}
