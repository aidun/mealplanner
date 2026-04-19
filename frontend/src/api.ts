import type { Meal, Plan, Profile, ShoppingList } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

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
  const hasBody = init.body !== undefined && init.body !== null;
  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...apiSecretHeader(),
    ...(init.headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
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

export async function getProfile() {
  return request<Profile>('/api/profile', undefined, { allow404: true });
}

export async function saveProfile(profile: Profile) {
  return request<Profile>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export async function getCurrentPlan() {
  return request<Plan>('/api/plans/current', undefined, { allow404: true });
}

export async function createPlan(payload: Record<string, unknown> = {}) {
  return request<Plan>('/api/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function regenerateMeal(planId: string, mealId: string, note: string) {
  return request<Meal | Plan | { plan?: Plan; meal?: Meal }>(
    `/api/plans/${encodeURIComponent(planId)}/meals/${encodeURIComponent(mealId)}/regenerate`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    }
  );
}

export async function getShoppingList(planId: string) {
  return request<ShoppingList>(`/api/plans/${encodeURIComponent(planId)}/shopping-list`, undefined, {
    allow404: true,
  });
}

function apiSecretHeader(): Record<string, string> {
  const secret =
    import.meta.env.VITE_API_SECRET ??
    (typeof window !== 'undefined' ? window.localStorage.getItem('mealplanner.apiSecret') : '');
  if (typeof secret === 'string' && secret !== '') {
    return { 'X-API-Secret': secret };
  }
  return {};
}
