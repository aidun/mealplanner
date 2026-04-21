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

export interface FavoriteRecipe {
  id: string;
  meal: Meal;
  createdAt?: string;
}

export interface FamilyMemberSummary {
  id: string;
  name: string;
  alias?: string;
}

export interface FamilyAccount {
  userId: string;
  email?: string;
  role?: string;
  linkedMemberId?: string;
}

export interface FamilySummary {
  id: string;
  name: string;
  memberCount: number;
  members?: FamilyMemberSummary[];
  accounts?: FamilyAccount[];
  personal: boolean;
  createdAt?: string;
  mergedWarning?: string;
}

export interface FamilyInvite {
  id: string;
  inviteLink: string;
  expiresAt: string;
  warningText?: string;
}

export interface PromptDebugEntry {
  operation: string;
  model?: string;
  prompt: string;
  createdAt?: string;
}

export interface OpenAIRequestMetric {
  operation: string;
  model: string;
  status: string;
  count: number;
  durationSum: number;
}

export interface OpenAITokenMetric {
  operation: string;
  model: string;
  type: string;
  count: number;
}

export interface PromptDebugSnapshot {
  latest?: PromptDebugEntry;
  recent?: PromptDebugEntry[];
  openai?: {
    requests?: OpenAIRequestMetric[];
    tokens?: OpenAITokenMetric[];
  };
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
  alias?: string;
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
  updatedAt?: string;
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

export type AuthProviderID = 'google' | 'apple' | string;

export interface AuthProvider {
  id: AuthProviderID;
  name: string;
  enabled: boolean;
  startUrl: string;
}

export interface AuthProvidersResponse {
  providers: AuthProvider[];
}

export interface Session {
  authenticated: boolean;
  csrfToken?: string;
}

export interface UpdateFamilyMemberLinkRequest {
  accountUserId: string;
  memberId: string;
}

export interface MemberFormState {
  id: string;
  name: string;
  alias: string;
  role: string;
  caloriesTarget: string;
  likes: string;
  dislikes: string;
  restrictions: string;
}

export interface ProfileFormState {
  householdName: string;
  members: MemberFormState[];
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
