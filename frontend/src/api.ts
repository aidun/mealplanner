import type {
  AuthProvidersResponse,
  FamilyInvite,
  FamilySummary,
  FavoriteRecipe,
  Meal,
  AdminOverview,
  PromptDebugSnapshot,
  Plan,
  Profile,
  Session,
  FeedbackEntry,
  ShoppingList,
  UpdateFamilyAccountSettingsRequest,
  UpdateFamilyMemberLinkRequest,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

let csrfToken = '';

// ApiError preserves the HTTP status so UI copy can distinguish validation, auth and server failures.
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { allow404?: boolean } = {}
): Promise<T | null> {
  // All mutating routes are cookie-authenticated and require the CSRF token from /api/session.
  const hasBody = init.body !== undefined && init.body !== null;
  const method = (init.method ?? 'GET').toUpperCase();
  const mutating = method === 'POST' || method === 'PUT' || method === 'DELETE';
  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(mutating && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    credentials: 'include',
    ...init,
  });

  if (response.status === 404 && options.allow404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text) as T;
}

export async function getSession() {
  try {
    const session = await request<Session>('/api/session');
    csrfToken = session?.csrfToken ?? '';
    return session ?? { authenticated: false };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      csrfToken = '';
      return { authenticated: false };
    }
    throw error;
  }
}

export async function getAuthProviders() {
  const response = await request<AuthProvidersResponse>('/api/auth/providers');
  return response ?? { providers: [] };
}

export async function logout() {
  await request<null>('/api/auth/logout', { method: 'POST' });
  csrfToken = '';
}

export async function skipProfileOnboarding() {
  return request<null>('/api/account/onboarding/skip', { method: 'POST' });
}

export async function getProfile() {
  return request<Profile>('/api/profile', undefined, { allow404: true });
}

export async function saveProfile(profile: Profile) {
  return request<Profile>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export async function getFamily() {
  return request<FamilySummary>('/api/family');
}

export async function createFamilyInvite(email: string) {
  return request<FamilyInvite>('/api/family/invites', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function acceptFamilyInvite(token: string) {
  return request<FamilySummary>('/api/family/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function updateFamilyMemberLink(payload: UpdateFamilyMemberLinkRequest) {
  return request<FamilySummary>('/api/family/member-links', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateFamilyAccountSettings(payload: UpdateFamilyAccountSettingsRequest) {
  return request<FamilySummary>('/api/family/account-settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getCurrentPlan() {
  return request<Plan>('/api/plans/current', undefined, { allow404: true });
}

export async function getPlanByWeek(weekStart: string) {
  const params = new URLSearchParams({ weekStart });
  return request<Plan>(`/api/plans?${params.toString()}`, undefined, { allow404: true });
}

export async function createPlan(payload: Record<string, unknown> = {}) {
  return request<Plan>('/api/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateMeal(planId: string, payload: { dayDate: string; slot: string; note?: string }) {
  return request<Plan>(`/api/plans/${encodeURIComponent(planId)}/meals`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function regenerateMeal(planId: string, mealId: string, note: string) {
  return request<Plan>(
    `/api/plans/${encodeURIComponent(planId)}/meals/${encodeURIComponent(mealId)}/regenerate`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    }
  );
}

export async function getFavorites() {
  return request<FavoriteRecipe[]>('/api/favorites');
}

export async function createFavorite(meal: Meal) {
  return request<FavoriteRecipe>('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ meal }),
  });
}

export async function deleteFavorite(favoriteId: string) {
  return request<null>(`/api/favorites/${encodeURIComponent(favoriteId)}`, { method: 'DELETE' });
}

export interface BringExportScope {
  day?: string;
  meal?: string;
  exclude?: string[];
}

// getBringExportUrl asks the backend to sign the exact week/day/meal scope before opening Bring.
export async function getBringExportUrl(planId: string, scope: BringExportScope = {}) {
  const params = new URLSearchParams();
  if (scope.day) params.set('day', scope.day);
  if (scope.meal) params.set('meal', scope.meal);
  for (const item of scope.exclude ?? []) {
    if (item.trim()) params.append('exclude', item.trim());
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return request<{ url: string; pageUrl?: string }>(
    `/api/plans/${encodeURIComponent(planId)}/bring-export-url${suffix}`
  );
}

export async function getShoppingList(planId: string) {
  return request<ShoppingList>(`/api/plans/${encodeURIComponent(planId)}/shopping-list`, undefined, {
    allow404: true,
  });
}

export async function getLatestPromptDebug() {
  return request<PromptDebugSnapshot>('/api/debug/prompts/latest', undefined, { allow404: true });
}

export async function getAdminOverview(options: { includeResolved?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.includeResolved) {
    params.set('includeResolved', 'true');
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return request<AdminOverview>(`/api/admin/overview${suffix}`);
}

export async function createFeedback(message: string, page: string) {
  return request<FeedbackEntry>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({ message, page }),
  });
}

export async function resolveFeedback(feedbackId: string) {
  return request<FeedbackEntry>(`/api/admin/feedback/${encodeURIComponent(feedbackId)}/resolve`, {
    method: 'POST',
  });
}
