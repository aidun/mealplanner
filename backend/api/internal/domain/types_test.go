package domain

import "testing"

func TestProfileValidate(t *testing.T) {
	profile := DefaultProfile()
	if err := profile.Validate(); err != nil {
		t.Fatalf("default profile should validate: %v", err)
	}

	profile.Members = nil
	if err := profile.Validate(); err == nil {
		t.Fatal("expected missing members to fail")
	}
}

func TestConsolidateShoppingList(t *testing.T) {
	plan := Plan{Days: []DayPlan{{
		Meals: []Meal{
			{Ingredients: []Ingredient{{Name: "Tomaten", Amount: 2, Unit: "Stk", Category: "Gemuese"}}},
			{Ingredients: []Ingredient{{Name: "tomaten", Amount: 1.5, Unit: "stk", Category: "Gemuese"}}},
		},
	}}}
	items := ConsolidateShoppingList(plan)
	if len(items) != 1 {
		t.Fatalf("expected one consolidated item, got %d", len(items))
	}
	if items[0].Amount != 3.5 {
		t.Fatalf("expected amount 3.5, got %v", items[0].Amount)
	}
}
