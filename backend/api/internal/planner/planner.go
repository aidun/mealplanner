package planner

import (
	"context"
	"fmt"
	"math"
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
	for dayIndex := range plan.Days {
		for mealIndex := range plan.Days[dayIndex].Meals {
			plan.Days[dayIndex].Meals[mealIndex] = normalizeGeneratedMeal(plan.Days[dayIndex].Meals[mealIndex], profile, plan.Days[dayIndex].Date)
		}
	}
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
				meal = normalizeGeneratedMeal(meal, profile, plan.Days[dayIndex].Date)
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
	matched, reuseKind := favoriteMatch(*meal, favorites)
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
	meal.Meta["favoriteReuse"] = reuseKind
	meal.Meta["favoriteTitle"] = matched.Meal.Title
}

func favoriteMatch(meal domain.Meal, favorites []domain.FavoriteRecipe) (*domain.FavoriteRecipe, string) {
	title := normalizeMealTitle(meal.Title)
	if title == "" {
		return nil, ""
	}
	for index := range favorites {
		favoriteTitle := normalizeMealTitle(favorites[index].Meal.Title)
		if favoriteTitle != "" && favoriteTitle == title {
			return &favorites[index], "direct"
		}
		if isFavoriteVariant(title, favoriteTitle) {
			return &favorites[index], "variant"
		}
	}
	return nil, ""
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

func isFavoriteVariant(title string, favoriteTitle string) bool {
	if title == "" || favoriteTitle == "" || title == favoriteTitle {
		return false
	}
	titleTokens := strings.Fields(title)
	favoriteTokens := strings.Fields(favoriteTitle)
	if len(titleTokens) == 0 || len(favoriteTokens) == 0 {
		return false
	}
	shared := 0
	set := map[string]bool{}
	for _, token := range favoriteTokens {
		set[token] = true
	}
	for _, token := range titleTokens {
		if set[token] {
			shared++
		}
	}
	minTokens := len(titleTokens)
	if len(favoriteTokens) < minTokens {
		minTokens = len(favoriteTokens)
	}
	return shared >= 2 && float64(shared)/float64(minTokens) >= 0.5
}

func normalizeGeneratedMeal(meal domain.Meal, profile domain.Profile, dayDate string) domain.Meal {
	meal.Title = strings.TrimSpace(meal.Title)
	if meal.Title == "" {
		meal.Title = slotFallbackTitle(meal.Slot)
	}
	meal.Description = strings.TrimSpace(meal.Description)
	if meal.Description == "" {
		meal.Description = fmt.Sprintf("%s fuer %s.", meal.Title, dayDate)
	}
	meal.Ingredients = normalizeIngredients(meal.Ingredients)
	meal.Instructions = normalizeInstructions(meal.Instructions)
	meal.Tags = normalizeStrings(meal.Tags)
	meal.Warnings = normalizeStrings(meal.Warnings)
	meal.Servings = normalizeServings(meal.Servings, profile)
	nutrition, warnings, nutritionSource := normalizeNutrition(meal, meal.Warnings)
	meal.Nutrition = nutrition
	meal.Warnings = warnings
	if meal.Meta == nil {
		meal.Meta = map[string]string{}
	}
	if nutritionSource != "" {
		meal.Meta["nutritionSource"] = nutritionSource
	}
	return meal
}

func normalizeIngredients(ingredients []domain.Ingredient) []domain.Ingredient {
	out := make([]domain.Ingredient, 0, len(ingredients))
	for _, ingredient := range ingredients {
		ingredient.Name = strings.TrimSpace(ingredient.Name)
		if ingredient.Name == "" {
			continue
		}
		ingredient.Unit = strings.TrimSpace(ingredient.Unit)
		ingredient.Category = strings.TrimSpace(ingredient.Category)
		ingredient.Note = strings.TrimSpace(ingredient.Note)
		if ingredient.Amount < 0 {
			ingredient.Amount = 0
		}
		out = append(out, ingredient)
	}
	return out
}

func normalizeInstructions(instructions []string) []string {
	out := normalizeStrings(instructions)
	if len(out) == 0 {
		return []string{"Nach Geschmack zubereiten und warm servieren."}
	}
	return out
}

func normalizeStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, value)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func normalizeServings(servings []domain.Serving, profile domain.Profile) []domain.Serving {
	if len(servings) == 0 {
		out := make([]domain.Serving, 0, len(profile.Members))
		for _, member := range profile.Members {
			out = append(out, domain.Serving{
				MemberID: member.ID,
				Name:     preferredAlias(member),
				Portion:  "100% Portion",
				Factor:   1,
			})
		}
		return out
	}
	out := make([]domain.Serving, 0, len(servings))
	for _, serving := range servings {
		serving.MemberID = strings.TrimSpace(serving.MemberID)
		serving.Name = strings.TrimSpace(serving.Name)
		serving.Portion = strings.TrimSpace(serving.Portion)
		if serving.Factor <= 0 {
			serving.Factor = 1
		}
		if serving.Portion == "" {
			serving.Portion = portionLabel(serving.Factor)
		}
		if serving.MemberID == "" && serving.Name != "" {
			serving.MemberID = strings.ToLower(strings.ReplaceAll(serving.Name, " ", "-"))
		}
		out = append(out, serving)
	}
	return out
}

func portionLabel(factor float64) string {
	if math.Abs(factor-1) < 0.01 {
		return "100% Portion"
	}
	return fmt.Sprintf("%d%% Portion", int(math.Round(factor*100)))
}

func normalizeNutrition(meal domain.Meal, warnings []string) (domain.Nutrition, []string, string) {
	nutrition := meal.Nutrition
	nutrition.Calories = maxInt(nutrition.Calories, 0)
	nutrition.ProteinG = maxInt(nutrition.ProteinG, 0)
	nutrition.CarbsG = maxInt(nutrition.CarbsG, 0)
	nutrition.FatG = maxInt(nutrition.FatG, 0)
	nutrition.FiberG = maxInt(nutrition.FiberG, 0)
	source := "provider"
	if estimated, ok := estimateNutritionFromIngredients(meal); ok {
		source = "ingredients"
		if meal.EstimatedNutrition {
			nutrition = estimated
			warnings = append(warnings, "Naehrwerte wurden aus Zutaten und Portionsgroessen geschaetzt.")
		} else if nutrition.Calories == 0 {
			nutrition = estimated
			warnings = append(warnings, "Naehrwerte wurden aus Zutaten und Portionsgroessen ergaenzt.")
		}
	}
	if nutrition.CarbsG > 0 && nutrition.FiberG > nutrition.CarbsG {
		nutrition.FiberG = nutrition.CarbsG
	}
	macroCalories := nutrition.ProteinG*4 + nutrition.CarbsG*4 + nutrition.FatG*9
	if macroCalories > 0 {
		diff := absInt(nutrition.Calories - macroCalories)
		threshold := maxInt(120, int(math.Round(float64(macroCalories)*0.35)))
		if nutrition.Calories == 0 || diff > threshold {
			nutrition.Calories = macroCalories
			if meal.EstimatedNutrition {
				warnings = append(warnings, "Naehrwerte wurden aus Makros plausibilisiert.")
			}
		}
	}
	return nutrition, normalizeStrings(warnings), source
}

func slotFallbackTitle(slot string) string {
	switch strings.TrimSpace(strings.ToLower(slot)) {
	case "breakfast":
		return "Fruehstueck"
	case "lunch":
		return "Mittagessen"
	case "dinner":
		return "Abendessen"
	case "snack":
		return "Snack"
	default:
		return "Mahlzeit"
	}
}

func absInt(value int) int {
	if value < 0 {
		return -value
	}
	return value
}

func maxInt(left int, right int) int {
	if left > right {
		return left
	}
	return right
}
