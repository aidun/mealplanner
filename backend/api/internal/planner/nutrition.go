package planner

import (
	"math"
	"strings"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
)

type ingredientNutritionProfile struct {
	keywords  []string
	nutrition domain.Nutrition // per 100g
	gramHint  float64
}

var ingredientProfiles = []ingredientNutritionProfile{
	{keywords: []string{"hafer", "oat"}, nutrition: domain.Nutrition{Calories: 389, ProteinG: 17, CarbsG: 66, FatG: 7, FiberG: 11}},
	{keywords: []string{"pasta", "nudel", "spaghetti", "penne"}, nutrition: domain.Nutrition{Calories: 350, ProteinG: 12, CarbsG: 70, FatG: 2, FiberG: 3}},
	{keywords: []string{"reis", "rice"}, nutrition: domain.Nutrition{Calories: 350, ProteinG: 7, CarbsG: 78, FatG: 1, FiberG: 1}},
	{keywords: []string{"brot", "bread"}, nutrition: domain.Nutrition{Calories: 250, ProteinG: 9, CarbsG: 47, FatG: 3, FiberG: 5}},
	{keywords: []string{"kartoffel", "potato"}, nutrition: domain.Nutrition{Calories: 77, ProteinG: 2, CarbsG: 17, FatG: 0, FiberG: 2}, gramHint: 180},
	{keywords: []string{"joghurt", "yogurt"}, nutrition: domain.Nutrition{Calories: 63, ProteinG: 5, CarbsG: 7, FatG: 2, FiberG: 0}},
	{keywords: []string{"skyr"}, nutrition: domain.Nutrition{Calories: 62, ProteinG: 11, CarbsG: 4, FatG: 0, FiberG: 0}},
	{keywords: []string{"quark"}, nutrition: domain.Nutrition{Calories: 68, ProteinG: 12, CarbsG: 4, FatG: 1, FiberG: 0}},
	{keywords: []string{"milch", "milk"}, nutrition: domain.Nutrition{Calories: 46, ProteinG: 3, CarbsG: 5, FatG: 2, FiberG: 0}},
	{keywords: []string{"ei", "egg"}, nutrition: domain.Nutrition{Calories: 143, ProteinG: 13, CarbsG: 1, FatG: 10, FiberG: 0}, gramHint: 60},
	{keywords: []string{"huhn", "chicken"}, nutrition: domain.Nutrition{Calories: 165, ProteinG: 31, CarbsG: 0, FatG: 4, FiberG: 0}},
	{keywords: []string{"lachs", "salmon"}, nutrition: domain.Nutrition{Calories: 208, ProteinG: 20, CarbsG: 0, FatG: 13, FiberG: 0}},
	{keywords: []string{"bohne", "bean"}, nutrition: domain.Nutrition{Calories: 127, ProteinG: 9, CarbsG: 23, FatG: 1, FiberG: 6}},
	{keywords: []string{"linse", "lentil"}, nutrition: domain.Nutrition{Calories: 116, ProteinG: 9, CarbsG: 20, FatG: 0, FiberG: 8}},
	{keywords: []string{"parmesan", "kaese", "mozzarella", "cheese"}, nutrition: domain.Nutrition{Calories: 330, ProteinG: 24, CarbsG: 2, FatG: 25, FiberG: 0}},
	{keywords: []string{"apfel", "apple"}, nutrition: domain.Nutrition{Calories: 52, ProteinG: 0, CarbsG: 14, FatG: 0, FiberG: 2}, gramHint: 150},
	{keywords: []string{"banane", "banana"}, nutrition: domain.Nutrition{Calories: 89, ProteinG: 1, CarbsG: 23, FatG: 0, FiberG: 3}, gramHint: 120},
	{keywords: []string{"beere", "berry"}, nutrition: domain.Nutrition{Calories: 45, ProteinG: 1, CarbsG: 10, FatG: 0, FiberG: 4}},
	{keywords: []string{"zucchini"}, nutrition: domain.Nutrition{Calories: 17, ProteinG: 1, CarbsG: 3, FatG: 0, FiberG: 1}, gramHint: 220},
	{keywords: []string{"brokkoli", "broccoli"}, nutrition: domain.Nutrition{Calories: 34, ProteinG: 3, CarbsG: 7, FatG: 0, FiberG: 3}},
	{keywords: []string{"karotte", "carrot"}, nutrition: domain.Nutrition{Calories: 41, ProteinG: 1, CarbsG: 10, FatG: 0, FiberG: 3}, gramHint: 80},
	{keywords: []string{"tomate", "tomato"}, nutrition: domain.Nutrition{Calories: 18, ProteinG: 1, CarbsG: 4, FatG: 0, FiberG: 1}, gramHint: 120},
	{keywords: []string{"zwiebel", "onion"}, nutrition: domain.Nutrition{Calories: 40, ProteinG: 1, CarbsG: 9, FatG: 0, FiberG: 2}, gramHint: 100},
	{keywords: []string{"olive oil", "olivenoel", "olivenöl", "öl", "oil"}, nutrition: domain.Nutrition{Calories: 884, ProteinG: 0, CarbsG: 0, FatG: 100, FiberG: 0}},
	{keywords: []string{"butter"}, nutrition: domain.Nutrition{Calories: 717, ProteinG: 1, CarbsG: 1, FatG: 81, FiberG: 0}},
	{keywords: []string{"nuss", "nut", "mandel", "almond"}, nutrition: domain.Nutrition{Calories: 607, ProteinG: 20, CarbsG: 21, FatG: 54, FiberG: 10}},
}

func estimateNutritionFromIngredients(meal domain.Meal) (domain.Nutrition, bool) {
	if len(meal.Ingredients) == 0 {
		return domain.Nutrition{}, false
	}
	total := nutritionAccumulator{}
	matched := 0
	for _, ingredient := range meal.Ingredients {
		profile, ok := lookupIngredientProfile(ingredient)
		if !ok {
			continue
		}
		grams := estimateIngredientGrams(ingredient, profile)
		if grams <= 0 {
			continue
		}
		total.add(profile.nutrition, grams/100)
		matched++
	}
	if matched == 0 {
		return domain.Nutrition{}, false
	}
	divisor := estimatedPortionCount(meal.Servings)
	if divisor <= 0 {
		divisor = 1
	}
	return total.perPortion(divisor), true
}

type nutritionAccumulator struct {
	calories float64
	protein  float64
	carbs    float64
	fat      float64
	fiber    float64
}

func (a *nutritionAccumulator) add(n domain.Nutrition, factor float64) {
	a.calories += float64(n.Calories) * factor
	a.protein += float64(n.ProteinG) * factor
	a.carbs += float64(n.CarbsG) * factor
	a.fat += float64(n.FatG) * factor
	a.fiber += float64(n.FiberG) * factor
}

func (a nutritionAccumulator) perPortion(divisor float64) domain.Nutrition {
	if divisor <= 0 {
		divisor = 1
	}
	return domain.Nutrition{
		Calories: int(math.Round(a.calories / divisor)),
		ProteinG: int(math.Round(a.protein / divisor)),
		CarbsG:   int(math.Round(a.carbs / divisor)),
		FatG:     int(math.Round(a.fat / divisor)),
		FiberG:   int(math.Round(a.fiber / divisor)),
	}
}

func lookupIngredientProfile(ingredient domain.Ingredient) (ingredientNutritionProfile, bool) {
	name := strings.ToLower(strings.TrimSpace(ingredient.Name))
	category := strings.ToLower(strings.TrimSpace(ingredient.Category))
	for _, profile := range ingredientProfiles {
		for _, keyword := range profile.keywords {
			if strings.Contains(name, keyword) || (category != "" && strings.Contains(category, keyword)) {
				return profile, true
			}
		}
	}
	return ingredientNutritionProfile{}, false
}

func estimateIngredientGrams(ingredient domain.Ingredient, profile ingredientNutritionProfile) float64 {
	amount := ingredient.Amount
	if amount <= 0 {
		return 0
	}
	unit := strings.ToLower(strings.TrimSpace(ingredient.Unit))
	switch unit {
	case "", "g", "gramm", "grams", "gr":
		return amount
	case "kg":
		return amount * 1000
	case "ml":
		return amount
	case "l":
		return amount * 1000
	case "stk", "stück", "stueck", "piece":
		if profile.gramHint > 0 {
			return amount * profile.gramHint
		}
		return amount * 120
	case "bund":
		if profile.gramHint > 0 {
			return amount * profile.gramHint
		}
		return amount * 30
	case "el", "tbsp":
		return amount * 15
	case "tl", "tsp":
		return amount * 5
	default:
		if profile.gramHint > 0 {
			return amount * profile.gramHint
		}
	}
	return 0
}

func estimatedPortionCount(servings []domain.Serving) float64 {
	if len(servings) == 0 {
		return 1
	}
	total := 0.0
	for _, serving := range servings {
		factor := serving.Factor
		if factor <= 0 {
			factor = 1
		}
		total += factor
	}
	if total <= 0 {
		return 1
	}
	return total
}
