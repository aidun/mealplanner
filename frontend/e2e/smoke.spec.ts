import { expect, test } from '@playwright/test';

test('planner smoke path', async ({ page, context }) => {
  const state = createState();

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/session') {
      return route.fulfill(json({ authenticated: true, csrfToken: 'csrf-token-1' }));
    }
    if (path === '/api/auth/providers') {
      return route.fulfill(json({ providers: [{ id: 'google', name: 'Google', enabled: true, startUrl: '/api/auth/google/start' }] }));
    }
    if (path === '/api/profile' && method === 'GET') {
      return route.fulfill(json(state.profile));
    }
    if (path === '/api/profile' && method === 'PUT') {
      state.profile = JSON.parse(request.postData() ?? '{}');
      return route.fulfill(json(state.profile));
    }
    if (path === '/api/family' && method === 'GET') {
      return route.fulfill(json(state.family));
    }
    if (path === '/api/favorites' && method === 'GET') {
      return route.fulfill(json(state.favorites));
    }
    if (path === '/api/favorites' && method === 'POST') {
      const payload = JSON.parse(request.postData() ?? '{}');
      const favorite = { id: `favorite-${payload.meal.id}`, meal: payload.meal };
      state.favorites = [favorite, ...state.favorites.filter((entry) => entry.id !== favorite.id)];
      return route.fulfill(json(favorite, 201));
    }
    if (path.startsWith('/api/favorites/') && method === 'DELETE') {
      const favoriteID = path.split('/').pop();
      state.favorites = state.favorites.filter((entry) => entry.id !== favoriteID);
      return route.fulfill({ status: 204, body: '' });
    }
    if (path === '/api/plans/current' && method === 'GET') {
      return route.fulfill(json(state.plan));
    }
    if (path === '/api/plans' && method === 'POST') {
      return route.fulfill(json(state.plan, 201));
    }
    if (path === '/api/plans/plan-1/shopping-list' && method === 'GET') {
      return route.fulfill(json(state.shoppingList));
    }
    if (path === '/api/plans/plan-1/meals/meal-1/regenerate' && method === 'POST') {
      const payload = JSON.parse(request.postData() ?? '{}');
      state.plan.days[0].meals[0] = {
        ...state.plan.days[0].meals[0],
        title: 'Cremige Gemüsepasta',
        description: 'Mit extra Gemüse und mild gewürzt.',
        regenerationNote: payload.note,
      };
      return route.fulfill(json(state.plan));
    }
    if (path === '/api/plans/plan-1/bring-export-url' && method === 'GET') {
      return route.fulfill(
        json({
          url: 'https://enjoy.getbring.com/ZAzR?token=test-token',
          pageUrl: '/api/plans/plan-1/bring-export?token=test-token',
        })
      );
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ status: 404, body: '' });
  });

  await page.goto('/');

  await expect(page.getByText('Planen, auswählen, kochen.')).toBeVisible();
  await expect(page.getByText('Wieder gern kochen')).toBeVisible();

  await page.getByLabel('Primäre Aktionen').getByRole('link', { name: 'Profil' }).click();
  await expect(page.getByText('Familienkonto pflegen')).toBeVisible();
  await page.getByLabel('Haushaltsname').fill('Familie Weber');
  await page.getByRole('button', { name: 'Profil speichern' }).click();
  await expect(page.getByText('Profil gespeichert. Der nächste Wochenplan nutzt diese Angaben.')).toBeVisible();
  await page.getByRole('button', { name: 'Zum Wochenplan' }).click();

  await page.getByRole('button', { name: /Pasta mit Gemüse/ }).click();
  await page.getByLabel('Wunsch zur Änderung').fill('Bitte schneller und mit mehr Gemüse.');
  await page.getByRole('button', { name: 'Gericht austauschen' }).click();
  await expect(page.getByRole('heading', { name: 'Cremige Gemüsepasta' })).toBeVisible();

  await page.getByRole('button', { name: 'Als Favorit merken' }).click();
  await expect(page.getByText('Wieder gern kochen')).toBeVisible();

  const bringLink = page.getByRole('link', { name: 'Rezept zu Bring' });
  await expect(bringLink).toHaveAttribute('href', /bring-export/);

  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    bringLink.click(),
  ]);
  await newPage.waitForLoadState();
  expect(newPage.url()).toContain('/api/plans/plan-1/bring-export?token=test-token');
});

test('login and invite acceptance stay on guarded production paths', async ({ page }) => {
  let authenticated = false;
  let inviteAccepted = false;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/session') {
      return route.fulfill(
        json(
          authenticated || inviteAccepted
            ? { authenticated: true, csrfToken: 'csrf-token-2' }
            : { authenticated: false }
        )
      );
    }
    if (path === '/api/auth/providers') {
      return route.fulfill(json({ providers: [{ id: 'google', name: 'Google', enabled: true, startUrl: '/api/auth/google/start' }] }));
    }
    if (path === '/api/family/invites/accept' && method === 'POST') {
      inviteAccepted = true;
      return route.fulfill(json({ id: 'family-1', name: 'Familie Weber', memberCount: 2, members: [] }));
    }
    if (path === '/api/profile' && method === 'GET') {
      return route.fulfill(json(createState().profile));
    }
    if (path === '/api/family' && method === 'GET') {
      return route.fulfill(json(createState().family));
    }
    if (path === '/api/plans/current' && method === 'GET') {
      return route.fulfill(json(createState().plan));
    }
    if (path === '/api/favorites' && method === 'GET') {
      return route.fulfill(json(createState().favorites));
    }
    if (path === '/api/plans/plan-1/shopping-list' && method === 'GET') {
      return route.fulfill(json(createState().shoppingList));
    }

    return route.fulfill({ status: 404, body: '' });
  });

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Mit Google anmelden' })).toBeVisible();
  await expect(page.getByText('Mealplanner')).toBeVisible();

  authenticated = true;
  await page.goto('/family/invites/accept?token=invite-token');
  await page.getByRole('button', { name: 'Einladung annehmen' }).click();
  await expect(page).toHaveURL(/\/onboarding\?family=joined$/);
  await expect(page.getByText('Familienkonto pflegen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prompt prüfen' })).toHaveCount(0);
});

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function createState() {
  return {
    profile: {
      householdName: 'Familie Weber',
      members: [
        { id: 'anna', name: 'Anna', alias: 'Mama', role: 'Erwachsen', likes: 'Mediterran' },
        { id: 'ben', name: 'Ben', alias: 'Ben', role: 'Kind', likes: 'Pasta' },
      ],
      defaults: {
        breakfast: 'Overnight Oats',
        lunch: 'Bowl',
        dinner: 'Pasta',
        snacks: 'Obst',
      },
      presets: ['Mediterran', 'schnell'],
      notes: 'Wochentags simpel',
    },
    family: {
      id: 'family-1',
      name: 'Familie Weber',
      memberCount: 2,
      members: [
        { id: 'anna', name: 'Anna', alias: 'Mama' },
        { id: 'ben', name: 'Ben', alias: 'Ben' },
      ],
      accounts: [
        { userId: 'user-1', email: 'anna@example.test', role: 'owner', linkedMemberId: 'anna' },
        { userId: 'user-2', email: 'ben@example.test', role: 'member', linkedMemberId: 'ben' },
      ],
      personal: false,
    },
    favorites: [
      {
        id: 'favorite-meal-2',
        meal: {
          id: 'meal-2',
          slot: 'breakfast',
          title: 'Beeren-Porridge',
          description: 'Warm, schnell und gut vorzubereiten.',
          servings: [{ memberId: 'anna', name: 'Anna', portion: '100% Portion', factor: 1 }],
          ingredients: [{ name: 'Haferflocken', amount: 80, unit: 'g' }],
          instructions: ['Haferflocken kochen', 'Beeren dazugeben'],
          nutrition: { calories: 410, proteinG: 18, carbsG: 58, fatG: 11 },
          estimatedNutrition: true,
          tags: ['schnell'],
        },
      },
    ],
    shoppingList: [{ name: 'Zucchini', amount: 2, unit: 'Stk', category: 'Gemüse' }],
    plan: {
      id: 'plan-1',
      weekStart: '2026-04-13',
      days: [
        {
          date: '2026-04-13',
          label: 'Mo',
          meals: [
            {
              id: 'meal-1',
              slot: 'dinner',
              title: 'Pasta mit Gemüse',
              description: 'Familienfreundlich und schnell.',
              servings: [
                { memberId: 'anna', name: 'Anna', portion: '100% Portion', factor: 1 },
                { memberId: 'ben', name: 'Ben', portion: '70% Portion', factor: 0.7 },
              ],
              ingredients: [{ name: 'Pasta', amount: 400, unit: 'g' }],
              instructions: ['Wasser kochen', 'Sauce mischen'],
              nutrition: { calories: 560, proteinG: 24, carbsG: 72, fatG: 14 },
              estimatedNutrition: true,
              tags: ['schnell', 'vegetarisch'],
            },
          ],
        },
        {
          date: '2026-04-14',
          label: 'Di',
          meals: [
            {
              id: 'meal-2',
              slot: 'breakfast',
              title: 'Beeren-Porridge',
              description: 'Warm, schnell und gut vorzubereiten.',
              servings: [{ memberId: 'anna', name: 'Anna', portion: '100% Portion', factor: 1 }],
              ingredients: [{ name: 'Haferflocken', amount: 80, unit: 'g' }],
              instructions: ['Haferflocken kochen', 'Beeren dazugeben'],
              nutrition: { calories: 410, proteinG: 18, carbsG: 58, fatG: 11 },
              estimatedNutrition: true,
              tags: ['schnell'],
            },
          ],
        },
      ],
    },
  };
}
