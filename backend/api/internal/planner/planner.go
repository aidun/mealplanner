package planner

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
)

// Generator is implemented by both live AI and deterministic mock providers.
type Generator interface {
	GenerateWeek(ctx context.Context, profile domain.Profile, weekStart time.Time, favorites []domain.FavoriteRecipe) (domain.Plan, error)
	RegenerateMeal(ctx context.Context, profile domain.Profile, plan domain.Plan, mealID string, note string, favorites []domain.FavoriteRecipe) (domain.Meal, error)
	MergeProfiles(ctx context.Context, target domain.Profile, incoming domain.Profile) (domain.Profile, error)
}

// Planner owns deterministic post-processing around provider output.
// Providers generate candidates; this layer enforces dates, slots, servings and shopping lists.
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

// GenerateWeek creates a complete seven-day plan and removes meals for disabled day/slot rules.
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
		allowedSlots := normalizeSlotSet(enabledSlotsForDay(profile, weekdayKeyFromDate(plan.Days[dayIndex].Date)))
		filteredMeals := make([]domain.Meal, 0, len(plan.Days[dayIndex].Meals))
		for mealIndex := range plan.Days[dayIndex].Meals {
			meal := plan.Days[dayIndex].Meals[mealIndex]
			if len(allowedSlots) > 0 && !allowedSlots[strings.ToLower(strings.TrimSpace(meal.Slot))] {
				continue
			}
			filteredMeals = append(filteredMeals, normalizeGeneratedMeal(meal, profile, plan.Days[dayIndex].Date))
		}
		plan.Days[dayIndex].Meals = filteredMeals
	}
	annotateFavoriteReusePlan(&plan, favorites)
	plan.ShoppingList = domain.ConsolidateShoppingList(plan)
	return plan, nil
}

// RegenerateMeal replaces exactly one meal while preserving its stable ID and slot in the existing plan.
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

// GenerateMeal creates or replaces one meal for a specific day/slot without rebuilding the full week.
func (p Planner) GenerateMeal(ctx context.Context, profile domain.Profile, plan domain.Plan, dayDate string, slot string, note string, favorites []domain.FavoriteRecipe) (domain.Plan, error) {
	if err := profile.Validate(); err != nil {
		return domain.Plan{}, err
	}
	dayDate = strings.TrimSpace(dayDate)
	if _, err := time.Parse("2006-01-02", dayDate); err != nil {
		return domain.Plan{}, fmt.Errorf("dayDate must use YYYY-MM-DD: %w", err)
	}
	slot = normalizeMealSlot(slot)
	if slot == "" {
		return domain.Plan{}, fmt.Errorf("slot is required")
	}

	dayIndex := -1
	for index := range plan.Days {
		if plan.Days[index].Date == dayDate {
			dayIndex = index
			break
		}
	}
	if dayIndex < 0 {
		return domain.Plan{}, fmt.Errorf("day %s not found in plan", dayDate)
	}

	mealIndex := -1
	mealID := ""
	for index := range plan.Days[dayIndex].Meals {
		if normalizeMealSlot(plan.Days[dayIndex].Meals[index].Slot) == slot {
			mealIndex = index
			mealID = plan.Days[dayIndex].Meals[index].ID
			break
		}
	}
	if strings.TrimSpace(mealID) == "" {
		mealID = fmt.Sprintf("%s-%s", dayDate, slot)
		plan.Days[dayIndex].Meals = append(plan.Days[dayIndex].Meals, domain.Meal{
			ID:          mealID,
			Slot:        slot,
			Title:       slotFallbackTitle(slot),
			Description: fmt.Sprintf("Einzelvorschlag für %s.", dayDate),
		})
		mealIndex = len(plan.Days[dayIndex].Meals) - 1
	}

	meal, err := p.generator.RegenerateMeal(ctx, profile, plan, mealID, note, favorites)
	if err != nil {
		return domain.Plan{}, err
	}
	meal.ID = mealID
	meal.Slot = slot
	meal = normalizeGeneratedMeal(meal, profile, dayDate)
	annotateFavoriteReuseMeal(&meal, favorites)
	plan.Days[dayIndex].Meals[mealIndex] = meal
	sortMealsBySlot(plan.Days[dayIndex].Meals)
	plan.Status = "planned"
	plan.ShoppingList = domain.ConsolidateShoppingList(plan)
	return plan, nil
}

// MergeProfiles combines a personal profile into an existing family profile before the account is moved.
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
	merged = repairMergedProfile(merged, target, incoming)
	if err := merged.Validate(); err != nil {
		return domain.Profile{}, err
	}
	return merged, nil
}

// repairMergedProfile keeps provider merges usable even when the model omits required profile fields.
func repairMergedProfile(merged domain.Profile, target domain.Profile, incoming domain.Profile) domain.Profile {
	if strings.TrimSpace(merged.HouseholdName) == "" {
		merged.HouseholdName = firstNonEmpty(target.HouseholdName, incoming.HouseholdName, "Privater Haushalt")
	}
	if len(merged.Members) == 0 {
		merged.Members = append([]domain.Member(nil), target.Members...)
		merged.Members = append(merged.Members, incoming.Members...)
	}
	sourceByID := map[string]domain.Member{}
	for _, member := range append(append([]domain.Member(nil), target.Members...), incoming.Members...) {
		id := strings.TrimSpace(member.ID)
		if id != "" {
			sourceByID[id] = member
		}
	}
	for index := range merged.Members {
		member := &merged.Members[index]
		if strings.TrimSpace(member.ID) == "" {
			member.ID = fmt.Sprintf("person-%d", index+1)
		}
		source := sourceByID[strings.TrimSpace(member.ID)]
		if strings.TrimSpace(member.Name) == "" {
			member.Name = firstNonEmpty(member.Alias, source.Name, source.Alias, fmt.Sprintf("Person %d", index+1))
		}
		if strings.TrimSpace(member.Alias) == "" {
			member.Alias = firstNonEmpty(source.Alias, member.Name)
		}
	}
	if merged.Defaults == (domain.MealDefaults{}) {
		merged.Defaults = target.Defaults
	}
	if len(merged.Presets) == 0 {
		merged.Presets = append([]string(nil), target.Presets...)
	}
	if strings.TrimSpace(merged.PreferredStores) == "" {
		merged.PreferredStores = firstNonEmpty(target.PreferredStores, incoming.PreferredStores)
	}
	if strings.TrimSpace(merged.ShoppingNotes) == "" {
		merged.ShoppingNotes = firstNonEmpty(target.ShoppingNotes, incoming.ShoppingNotes)
	}
	merged.Appliances = appendUniqueStrings(merged.Appliances, target.Appliances...)
	merged.Appliances = appendUniqueStrings(merged.Appliances, incoming.Appliances...)
	return merged
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
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

func (p Planner) ResolveWeekStart(value string) (string, error) {
	start, err := parseOrNextWeekStart(value, p.now())
	if err != nil {
		return "", err
	}
	return start.Format("2006-01-02"), nil
}

func (p Planner) PreviewMergePrompt(target domain.Profile, incoming domain.Profile) string {
	return MergeProfilePrompt(target, incoming)
}

// parseOrNextWeekStart normalizes every requested date to its Monday week boundary.
func parseOrNextWeekStart(value string, now time.Time) (time.Time, error) {
	if value != "" {
		parsed, err := time.Parse("2006-01-02", value)
		if err != nil {
			return time.Time{}, fmt.Errorf("weekStart must use YYYY-MM-DD: %w", err)
		}
		return monday(parsed), nil
	}
	return nextMonday(now), nil
}

func monday(t time.Time) time.Time {
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	return dateOnly(t).AddDate(0, 0, -(weekday - 1))
}

func nextMonday(t time.Time) time.Time {
	days := (int(time.Monday) - int(t.Weekday()) + 7) % 7
	if days == 0 {
		days = 7
	}
	return dateOnly(t).AddDate(0, 0, days)
}

func dateOnly(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

// normalizeDays returns exactly seven ordered days and derives German labels from the ISO date.
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
	out := make([]domain.DayPlan, 0, 7)
	for i := 0; i < 7; i++ {
		date := weekStart.AddDate(0, 0, i)
		key := date.Format("2006-01-02")
		day, ok := byDate[key]
		if !ok {
			day = domain.DayPlan{Date: key}
		}
		day.Date = key
		day.Label = weekdayLabel(date)
		out = append(out, day)
	}
	return out
}

func weekdayLabel(t time.Time) string {
	labels := []string{"Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"}
	return labels[int(t.Weekday())]
}

func annotateFavoriteReusePlan(plan *domain.Plan, favorites []domain.FavoriteRecipe) {
	for dayIndex := range plan.Days {
		for mealIndex := range plan.Days[dayIndex].Meals {
			annotateFavoriteReuseMeal(&plan.Days[dayIndex].Meals[mealIndex], favorites)
		}
	}
}

// annotateFavoriteReuseMeal stores lightweight UI hints without changing the generated meal body.
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

// normalizeGeneratedMeal trims and repairs provider output before it is stored or shown to users.
func normalizeGeneratedMeal(meal domain.Meal, profile domain.Profile, dayDate string) domain.Meal {
	meal.Title = strings.TrimSpace(meal.Title)
	if meal.Title == "" {
		meal.Title = slotFallbackTitle(meal.Slot)
	}
	meal.Description = strings.TrimSpace(meal.Description)
	if meal.Description == "" {
		meal.Description = fmt.Sprintf("%s für %s.", meal.Title, dayDate)
	}
	meal.Ingredients = normalizeIngredients(meal.Ingredients)
	meal.Instructions = normalizeInstructions(meal.Instructions)
	meal.Tags = normalizeStrings(meal.Tags)
	meal.Warnings = normalizeStrings(meal.Warnings)
	meal.Servings = normalizeServings(meal.Servings, profile, meal.Slot, dayDate)
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

// normalizeServings limits portions to the participants configured for the meal slot on that weekday.
func normalizeServings(servings []domain.Serving, profile domain.Profile, slot string, dayDate string) []domain.Serving {
	selectedMembers := participantsForSlotOnDay(profile, slot, weekdayKeyFromDate(dayDate))
	if len(servings) == 0 {
		out := make([]domain.Serving, 0, len(selectedMembers))
		for _, member := range selectedMembers {
			out = append(out, defaultServingForMember(member))
		}
		return out
	}
	allowed := map[string]domain.Member{}
	for _, member := range selectedMembers {
		allowed[strings.ToLower(strings.TrimSpace(member.ID))] = member
	}
	out := make([]domain.Serving, 0, len(servings))
	seen := map[string]bool{}
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
		if len(allowed) > 0 {
			member, ok := allowed[strings.ToLower(serving.MemberID)]
			if !ok {
				continue
			}
			serving.MemberID = member.ID
			if serving.Name == "" {
				serving.Name = preferredAlias(member)
			}
			key := strings.ToLower(strings.TrimSpace(member.ID))
			if seen[key] {
				continue
			}
			seen[key] = true
		}
		out = append(out, serving)
	}
	for _, member := range selectedMembers {
		key := strings.ToLower(strings.TrimSpace(member.ID))
		if key == "" || seen[key] {
			continue
		}
		out = append(out, defaultServingForMember(member))
	}
	return out
}

func defaultServingForMember(member domain.Member) domain.Serving {
	return domain.Serving{
		MemberID: member.ID,
		Name:     preferredAlias(member),
		Portion:  "100% Portion",
		Factor:   1,
	}
}

func normalizeSlotSet(slots []string) map[string]bool {
	if len(slots) == 0 {
		return nil
	}
	out := map[string]bool{}
	for _, slot := range slots {
		slot = strings.ToLower(strings.TrimSpace(slot))
		if slot != "" {
			out[slot] = true
		}
	}
	return out
}

func normalizeMealSlot(value string) string {
	key := strings.ToLower(strings.TrimSpace(value))
	switch key {
	case "frühstück", "fruehstueck", "breakfast":
		return "breakfast"
	case "mittagessen", "lunch":
		return "lunch"
	case "abendessen", "dinner":
		return "dinner"
	case "snack", "snacks":
		return "snack"
	default:
		return ""
	}
}

func sortMealsBySlot(meals []domain.Meal) {
	order := map[string]int{"breakfast": 0, "lunch": 1, "dinner": 2, "snack": 3}
	sort.SliceStable(meals, func(i, j int) bool {
		left, leftOK := order[normalizeMealSlot(meals[i].Slot)]
		right, rightOK := order[normalizeMealSlot(meals[j].Slot)]
		switch {
		case leftOK && rightOK:
			return left < right
		case leftOK:
			return true
		case rightOK:
			return false
		default:
			return meals[i].Slot < meals[j].Slot
		}
	})
}

func appendUniqueStrings(values []string, more ...string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(values)+len(more))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, trimmed)
	}
	for _, value := range more {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, trimmed)
	}
	return out
}

func portionLabel(factor float64) string {
	if math.Abs(factor-1) < 0.01 {
		return "100% Portion"
	}
	return fmt.Sprintf("%d%% Portion", int(math.Round(factor*100)))
}

// normalizeNutrition reconciles provider nutrition with local ingredient and macro heuristics.
func normalizeNutrition(meal domain.Meal, warnings []string) (domain.Nutrition, []string, string) {
	nutrition := meal.Nutrition
	nutrition.Calories = maxInt(nutrition.Calories, 0)
	nutrition.ProteinG = maxInt(nutrition.ProteinG, 0)
	nutrition.CarbsG = maxInt(nutrition.CarbsG, 0)
	nutrition.FatG = maxInt(nutrition.FatG, 0)
	nutrition.FiberG = maxInt(nutrition.FiberG, 0)
	source := "provider"
	if nutrition.Calories == 0 {
		if estimated, ok := estimateNutritionFromIngredients(meal); ok {
			source = "ingredients"
			nutrition = estimated
			warnings = append(warnings, "Nährwerte wurden aus Zutaten und Portionsgrößen ergänzt.")
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
				warnings = append(warnings, "Nährwerte wurden aus Makros plausibilisiert.")
			}
		}
	}
	return nutrition, normalizeStrings(warnings), source
}

func slotFallbackTitle(slot string) string {
	switch strings.TrimSpace(strings.ToLower(slot)) {
	case "breakfast":
		return "Frühstück"
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
