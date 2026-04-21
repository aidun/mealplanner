package planner

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
)

type Generator interface {
	GenerateWeek(ctx context.Context, profile domain.Profile, weekStart time.Time, favorites []domain.FavoriteRecipe) (domain.Plan, error)
	RegenerateMeal(ctx context.Context, profile domain.Profile, plan domain.Plan, mealID string, note string, favorites []domain.FavoriteRecipe) (domain.Meal, error)
	MergeProfiles(ctx context.Context, target domain.Profile, incoming domain.Profile) (domain.Profile, error)
}

type Planner struct {
	generator Generator
	now       func() time.Time
}

func New(generator Generator) Planner {
	return Planner{generator: generator, now: time.Now}
}

func (p Planner) WithNow(now func() time.Time) Planner {
	p.now = now
	return p
}

func (p Planner) GenerateWeek(ctx context.Context, profile domain.Profile, weekStart string, favorites []domain.FavoriteRecipe) (domain.Plan, error) {
	if err := profile.Validate(); err != nil {
		return domain.Plan{}, err
	}
	start, err := parseOrNextWeekStart(weekStart, p.now())
	if err != nil {
		return domain.Plan{}, err
	}
	plan, err := p.generator.GenerateWeek(ctx, profile, start, favorites)
	if err != nil {
		return domain.Plan{}, err
	}
	plan.WeekStart = start.Format("2006-01-02")
	plan.Status = "planned"
	plan.Days = normalizeDays(plan.Days, start)
	annotateFavoriteReusePlan(&plan, favorites)
	plan.ShoppingList = domain.ConsolidateShoppingList(plan)
	return plan, nil
}

func (p Planner) RegenerateMeal(ctx context.Context, profile domain.Profile, plan domain.Plan, mealID string, note string, favorites []domain.FavoriteRecipe) (domain.Plan, error) {
	if err := profile.Validate(); err != nil {
		return domain.Plan{}, err
	}
	meal, err := p.generator.RegenerateMeal(ctx, profile, plan, mealID, note, favorites)
	if err != nil {
		return domain.Plan{}, err
	}
	found := false
	for dayIndex := range plan.Days {
		for mealIndex := range plan.Days[dayIndex].Meals {
			if plan.Days[dayIndex].Meals[mealIndex].ID == mealID {
				original := plan.Days[dayIndex].Meals[mealIndex]
				meal.ID = mealID
				meal.Slot = original.Slot
				annotateFavoriteReuseMeal(&meal, favorites)
				plan.Days[dayIndex].Meals[mealIndex] = meal
				found = true
			}
		}
	}
	if !found {
		return domain.Plan{}, fmt.Errorf("meal %s not found", mealID)
	}
	plan.Status = "planned"
	plan.ShoppingList = domain.ConsolidateShoppingList(plan)
	return plan, nil
}

func (p Planner) MergeProfiles(ctx context.Context, target domain.Profile, incoming domain.Profile) (domain.Profile, error) {
	if err := target.Validate(); err != nil {
		return domain.Profile{}, err
	}
	if err := incoming.Validate(); err != nil {
		return domain.Profile{}, err
	}
	merged, err := p.generator.MergeProfiles(ctx, target, incoming)
	if err != nil {
		return domain.Profile{}, err
	}
	if err := merged.Validate(); err != nil {
		return domain.Profile{}, err
	}
	return merged, nil
}

func (p Planner) PreviewWeekPrompt(profile domain.Profile, weekStart string, favorites []domain.FavoriteRecipe) (string, error) {
	start, err := parseOrNextWeekStart(weekStart, p.now())
	if err != nil {
		return "", err
	}
	return WeekPrompt(profile, start, favorites), nil
}

func (p Planner) PreviewRegeneratePrompt(profile domain.Profile, plan domain.Plan, mealID string, note string, favorites []domain.FavoriteRecipe) string {
	return RegeneratePrompt(profile, plan, mealID, note, favorites)
}

func (p Planner) PreviewMergePrompt(target domain.Profile, incoming domain.Profile) string {
	return MergeProfilePrompt(target, incoming)
}

func parseOrNextWeekStart(value string, now time.Time) (time.Time, error) {
	if value != "" {
		parsed, err := time.Parse("2006-01-02", value)
		if err != nil {
			return time.Time{}, fmt.Errorf("weekStart must use YYYY-MM-DD: %w", err)
		}
		return monday(parsed), nil
	}
	return nextSunday(now), nil
}

func monday(t time.Time) time.Time {
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	return dateOnly(t).AddDate(0, 0, -(weekday - 1))
}

func nextSunday(t time.Time) time.Time {
	days := (7 - int(t.Weekday())) % 7
	return dateOnly(t).AddDate(0, 0, days)
}

func dateOnly(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

func normalizeDays(days []domain.DayPlan, weekStart time.Time) []domain.DayPlan {
	byDate := map[string]domain.DayPlan{}
	for _, day := range days {
		if day.Date == "" {
			continue
		}
		if _, exists := byDate[day.Date]; !exists {
			byDate[day.Date] = day
		}
	}
	labels := []string{"Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"}
	out := make([]domain.DayPlan, 0, 7)
	for i := 0; i < 7; i++ {
		date := weekStart.AddDate(0, 0, i)
		key := date.Format("2006-01-02")
		day, ok := byDate[key]
		if !ok {
			day = domain.DayPlan{Date: key}
		}
		day.Date = key
		if day.Label == "" {
			day.Label = labels[int(date.Weekday())]
		}
		out = append(out, day)
	}
	return out
}

func annotateFavoriteReusePlan(plan *domain.Plan, favorites []domain.FavoriteRecipe) {
	for dayIndex := range plan.Days {
		for mealIndex := range plan.Days[dayIndex].Meals {
			annotateFavoriteReuseMeal(&plan.Days[dayIndex].Meals[mealIndex], favorites)
		}
	}
}

func annotateFavoriteReuseMeal(meal *domain.Meal, favorites []domain.FavoriteRecipe) {
	if meal == nil {
		return
	}
	matched := favoriteMatch(*meal, favorites)
	if matched == nil {
		if meal.Meta != nil {
			delete(meal.Meta, "favoriteReuse")
			delete(meal.Meta, "favoriteTitle")
			if len(meal.Meta) == 0 {
				meal.Meta = nil
			}
		}
		return
	}
	if meal.Meta == nil {
		meal.Meta = map[string]string{}
	}
	meal.Meta["favoriteReuse"] = "direct"
	meal.Meta["favoriteTitle"] = matched.Meal.Title
}

func favoriteMatch(meal domain.Meal, favorites []domain.FavoriteRecipe) *domain.FavoriteRecipe {
	title := normalizeMealTitle(meal.Title)
	if title == "" {
		return nil
	}
	for index := range favorites {
		favoriteTitle := normalizeMealTitle(favorites[index].Meal.Title)
		if favoriteTitle != "" && favoriteTitle == title {
			return &favorites[index]
		}
	}
	return nil
}

func normalizeMealTitle(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	if value == "" {
		return ""
	}
	replacer := strings.NewReplacer(
		"ä", "ae",
		"ö", "oe",
		"ü", "ue",
		"ß", "ss",
	)
	value = replacer.Replace(value)
	value = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			return r
		case r >= '0' && r <= '9':
			return r
		case r == ' ':
			return r
		default:
			return -1
		}
	}, value)
	return strings.Join(strings.Fields(value), " ")
}
