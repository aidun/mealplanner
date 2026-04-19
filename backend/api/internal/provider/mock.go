package provider

import (
	"context"
	"fmt"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
)

type MockGenerator struct {
	now func() time.Time
}

func NewMockGenerator() MockGenerator {
	return MockGenerator{now: time.Now}
}

func (g MockGenerator) GenerateWeek(_ context.Context, profile domain.Profile, weekStart time.Time) (domain.Plan, error) {
	plan := domain.Plan{
		ID:        fmt.Sprintf("plan-%s", weekStart.Format("20060102")),
		WeekStart: weekStart.Format("2006-01-02"),
		Status:    "planned",
		Days:      make([]domain.DayPlan, 0, 7),
		CreatedAt: g.now(),
		UpdatedAt: g.now(),
	}
	labels := []string{"Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"}
	slots := []string{"breakfast", "lunch", "dinner"}
	titles := map[string]string{
		"breakfast": "Joghurt-Bowl mit Apfel, Nuss und Hafer",
		"lunch":     "Gruene Pasta mit Erbsen, Zitrone und Parmesan",
		"dinner":    "Ofengemuese mit Kraeuterquark und warmem Brot",
		"snack":     "Beeren-Skyr mit dunkler Schokolade",
	}
	for i := 0; i < 7; i++ {
		date := weekStart.AddDate(0, 0, i)
		day := domain.DayPlan{Date: date.Format("2006-01-02"), Label: labels[int(date.Weekday())]}
		for _, slot := range slots {
			day.Meals = append(day.Meals, g.meal(profile, date, slot, titles[slot], ""))
		}
		if i == 2 || i == 5 {
			day.Meals = append(day.Meals, g.meal(profile, date, "snack", titles["snack"], "optionaler Snack"))
		}
		plan.Days = append(plan.Days, day)
	}
	plan.ShoppingList = domain.ConsolidateShoppingList(plan)
	return plan, nil
}

func (g MockGenerator) RegenerateMeal(_ context.Context, profile domain.Profile, plan domain.Plan, mealID string, note string) (domain.Meal, error) {
	for _, day := range plan.Days {
		for _, meal := range day.Meals {
			if meal.ID == mealID {
				title := "Neu geplant: " + meal.Title
				if note != "" {
					title = "Neu geplant nach Wunsch"
				}
				return g.meal(profile, mustDate(day.Date), meal.Slot, title, note), nil
			}
		}
	}
	return domain.Meal{}, fmt.Errorf("meal %s not found", mealID)
}

func (g MockGenerator) meal(profile domain.Profile, date time.Time, slot string, title string, note string) domain.Meal {
	nutrition := domain.Nutrition{Calories: 520, ProteinG: 28, CarbsG: 58, FatG: 18, FiberG: 9}
	if slot == "breakfast" {
		nutrition = domain.Nutrition{Calories: 430, ProteinG: 24, CarbsG: 52, FatG: 14, FiberG: 8}
	}
	if slot == "snack" {
		nutrition = domain.Nutrition{Calories: 210, ProteinG: 17, CarbsG: 18, FatG: 8, FiberG: 4}
	}
	servings := make([]domain.Serving, 0, len(profile.Members))
	for _, member := range profile.Members {
		factor := 1.0
		if member.CaloriesTarget > 0 && member.CaloriesTarget < 1800 {
			factor = 0.75
		}
		servings = append(servings, domain.Serving{MemberID: member.ID, Name: member.Name, Portion: fmt.Sprintf("%.0f%% Portion", factor*100), Factor: factor})
	}
	return domain.Meal{
		ID:          fmt.Sprintf("%s-%s", date.Format("20060102"), slot),
		Slot:        slot,
		Title:       title,
		Description: "Frisch, familientauglich und auf die hinterlegten Vorlieben abgestimmt.",
		Servings:    servings,
		Ingredients: []domain.Ingredient{
			{Name: "Frisches Gemuese", Amount: 600, Unit: "g", Category: "Gemuese"},
			{Name: "Kraeuter", Amount: 1, Unit: "Bund", Category: "Gemuese"},
			{Name: "Joghurt", Amount: 400, Unit: "g", Category: "Milchprodukte"},
		},
		Instructions:       []string{"Zutaten vorbereiten und abschmecken.", "Schonend garen oder frisch anrichten.", "Portionen pro Person skalieren und direkt servieren."},
		Nutrition:          nutrition,
		Tags:               []string{"familientauglich", "geschaetzt", slot},
		Warnings:           []string{"Naehrwerte sind Schaetzungen."},
		EstimatedNutrition: true,
		RegenerationNote:   note,
		GeneratedAt:        g.now(),
	}
}

func mustDate(value string) time.Time {
	t, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Now()
	}
	return t
}
