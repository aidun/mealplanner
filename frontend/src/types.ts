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

// Meal mirrors the backend provider contract; meta carries narrow UI hints such as favorite reuse.
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
  meta?: Record<string, string>;
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
  settings?: AccountSettings;
}

// FamilySummary separates login accounts from cooking-profile members.
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
  meta?: Record<string, string>;
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

// PromptDebugSnapshot is available only in test/debug builds and powers the prompt overlay.
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

// Profile is the shared cooking profile for a family, not the authenticated login account.
export interface Profile {
  householdName: string;
  members: Member[];
  defaults: MealDefaults;
  presets: string[];
  notes?: string;
  preferredStores?: string;
  shoppingNotes?: string;
  appliances?: string[];
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

// ShoppingList supports both the old flat array and the newer sectioned document shape.
export type ShoppingList = ShoppingListItem[] | ShoppingListDocument;


// Session is frontend boot data; csrfToken is cached by api.ts for mutating requests.
export interface Session {
  authenticated: boolean;
  csrfToken?: string;
  userID?: string;
  email?: string;
  isAdmin?: boolean;
  onboardingRequired?: boolean;
}

export interface AccountSettings {
  weeklyPlanEmailEnabled: boolean;
  recipeEmailEnabled: boolean;
  updatedAt?: string;
}

export type FeedbackStatus = 'open' | 'resolved';

export interface FeedbackEntry {
  id: string;
  message: string;
  page?: string;
  status: FeedbackStatus;
  createdAt?: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
}

export interface StatsBucket {
  label: string;
  count: number;
}

export interface GenerationCount {
  category: string;
  count: number;
}

export interface AdminStats {
  averageActiveAccountsPerFamily: number;
  averageProfileMembersPerFamily: number;
  familyDistributionByAccounts?: StatsBucket[];
  familyDistributionByMembers?: StatsBucket[];
  generations?: GenerationCount[];
}

export interface AdminOverview {
  feedback?: FeedbackEntry[];
  resolvedFeedback?: FeedbackEntry[];
  stats: AdminStats;
}

export interface UpdateFamilyMemberLinkRequest {
  accountUserId: string;
  memberId: string;
}

export interface UpdateFamilyAccountSettingsRequest {
  accountUserId: string;
  settings: AccountSettings;
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

export interface MealPlanSlotFormState {
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  label: string;
  enabled: boolean;
  memberIds: string[];
}

export interface MealPlanDayFormState {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  label: string;
  slots: MealPlanSlotFormState[];
}

// ProfileFormState is intentionally denormalized so the large profile editor can stay controlled.
export interface ProfileFormState {
  householdName: string;
  members: MemberFormState[];
  mealPlanDays: MealPlanDayFormState[];
  servingsPerMeal: string;
  preferredCuisines: string;
  excludedIngredients: string;
  preferredStores: string;
  shoppingNotes: string;
  appliances: string;
  cookingStyle: string;
  mealPlanningRules: string;
  breakfastPresets: string;
  lunchPresets: string;
  dinnerPresets: string;
  snackPresets: string;
}
