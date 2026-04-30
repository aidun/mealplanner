package domain

import (
	"math"
	"sort"
	"strings"
)

// ConsolidateShoppingList folds meal ingredients into a stable, category-sorted shopping list.
// Items merge only when name and unit match, so "2 Stk Zitrone" does not combine with "200 g Zitrone".
func ConsolidateShoppingList(plan Plan) []ShoppingItem {
	type key struct {
		name string
		unit string
	}
	items := map[key]ShoppingItem{}
	for _, day := range plan.Days {
		for _, meal := range day.Meals {
			for _, ingredient := range meal.Ingredients {
				name := strings.TrimSpace(ingredient.Name)
				if name == "" {
					continue
				}
				k := key{name: strings.ToLower(name), unit: strings.ToLower(strings.TrimSpace(ingredient.Unit))}
				existing := items[k]
				if existing.Name == "" {
					existing = ShoppingItem{
						Name:     name,
						Unit:     ingredient.Unit,
						Category: ingredient.Category,
						Note:     ingredient.Note,
					}
				}
				existing.Amount = roundOne(existing.Amount + ingredient.Amount)
				if existing.Category == "" {
					existing.Category = ingredient.Category
				}
				items[k] = existing
			}
		}
	}
	out := make([]ShoppingItem, 0, len(items))
	for _, item := range items {
		out = append(out, item)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Category == out[j].Category {
			return out[i].Name < out[j].Name
		}
		return out[i].Category < out[j].Category
	})
	return out
}

func roundOne(v float64) float64 {
	return math.Round(v*10) / 10
}
