export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface Nutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}

export interface Ingredient {
  name: string;
  amount?: number;
  unit?: string;
  category?: string;
  note?: string;
}

export interface Serving {
  memberId: string;
  name: string;
  portion: string;
  factor: number;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | string;

export interface Meal {
  id: string;
  slot: MealSlot;
  title: string;
  description: string;
  servings: Serving[];
  ingredients: Ingredient[];
  instructions: string[];
  nutrition: Nutrition;
  estimatedNutrition: boolean;
  tags: string[];
  warnings?: string[];
  regenerationNote?: string;
}

export interface Day {
  date: string;
  label?: string;
  meals: Meal[];
}

export interface Plan {
  id: string;
  weekStart: string;
  status: string;
  days: Day[];
  shoppingList?: ShoppingListItem[];
}

export interface Member {
  id: string;
  name: string;
  role?: string;
  age?: number;
  caloriesTarget?: number;
  presets?: string[];
  likes?: string;
  dislikes?: string;
  restrictions?: string;
}

export interface MealDefaults {
  breakfast?: string;
  lunch?: string;
  dinner?: string;
  snacks?: string;
}

export interface Profile {
  householdName: string;
  members: Member[];
  defaults: MealDefaults;
  presets: string[];
  notes?: string;
}

export interface ShoppingListItem {
  name: string;
  amount?: number;
  unit?: string;
  category?: string;
  note?: string;
  checked?: boolean;
}

export interface ShoppingListSection {
  title: string;
  items: ShoppingListItem[];
}

export interface ShoppingListDocument {
  title?: string;
  summary?: string;
  sections?: ShoppingListSection[];
  items?: ShoppingListItem[];
}

export type ShoppingList = ShoppingListItem[] | ShoppingListDocument;

export interface ProfileFormState {
  householdName: string;
  members: string;
  servingsPerMeal: string;
  preferredCuisines: string;
  excludedIngredients: string;
  cookingStyle: string;
  mealPlanningRules: string;
  breakfastPresets: string;
  lunchPresets: string;
  dinnerPresets: string;
  snackPresets: string;
}
