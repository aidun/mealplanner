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

  await expect(page.getByText('Woche, Rezept und Einkauf an einem Tisch')).toBeVisible();

  await page.getByLabel('Primäre Aktionen').getByRole('link', { name: 'Küchenprofil' }).click();
  await expect(page.getByText('Was eure Familie gern isst')).toBeVisible();
  await page.getByLabel('Familienname').fill('Familie Weber');
  await page.getByRole('button', { name: 'Für unsere Woche merken' }).click();
  await expect(page.getByText('Gespeichert. Der nächste Wochenplan nutzt euren Familiengeschmack.')).toBeVisible();
  await page.getByRole('button', { name: 'Zum Wochenplan' }).click();

  await expect(page.getByRole('textbox', { name: 'Feedback' })).toHaveCount(0);

  await page.getByRole('button', { name: /Abendessen Pasta mit Gemüse/ }).click();
  await page.getByLabel('Wunsch zur Änderung').fill('Bitte schneller und mit mehr Gemüse.');
  await page.getByRole('button', { name: 'Einzelnes Gericht vorschlagen' }).click();
  await expect(page.getByRole('heading', { name: 'Cremige Gemüsepasta' })).toBeVisible();

  await page.getByRole('button', { name: 'Als Favorit merken' }).click();

  const bringLink = page.getByRole('link', { name: 'Rezept zu Bring' });
  await expect(bringLink).toHaveAttribute('href', /bring-export/);

  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    bringLink.click(),
  ]);
  await newPage.waitForLoadState();
  expect(newPage.url()).toContain('/api/plans/plan-1/bring-export?token=test-token');

  await page.getByLabel('Primäre Aktionen').getByRole('link', { name: 'Küchenprofil' }).click();
  await page.getByRole('button', { name: 'Lieblingsgerichte' }).click();
  await expect(page.getByText('2 gespeicherte Rezepte')).toBeVisible();
});

test('planner stays stable across desktop tablet and mobile breakpoints', async ({ page }) => {
  const state = createState();

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/session') return route.fulfill(json({ authenticated: true, csrfToken: 'csrf-token-1' }));
    if (path === '/api/profile' && method === 'GET') return route.fulfill(json(state.profile));
    if (path === '/api/family' && method === 'GET') return route.fulfill(json(state.family));
    if (path === '/api/favorites' && method === 'GET') return route.fulfill(json(state.favorites));
    if (path === '/api/plans/current' && method === 'GET') return route.fulfill(json(state.plan));
    if (path === '/api/plans/plan-1/shopping-list' && method === 'GET') return route.fulfill(json(state.shoppingList));
    if (path.includes('/api/plans/plan-1/bring-export-url') && method === 'GET') {
      return route.fulfill(json({ url: 'https://enjoy.getbring.com/ZAzR?token=test-token', pageUrl: '/api/plans/plan-1/bring-export?token=test-token' }));
    }
    if (path === '/api/auth/logout' && method === 'POST') return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 404, body: '' });
  });

  const viewports = [
    { name: 'desktop', size: { width: 1440, height: 1100 } },
    { name: 'tablet', size: { width: 1024, height: 1180 } },
    { name: 'mobile', size: { width: 393, height: 852 } },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport.size);
    await page.goto('/');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    await page.waitForTimeout(80);
    await expect(page.getByText('Wochen-Workbench')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Feedback' })).toHaveCount(0);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

    const mainBox = await page.locator('.workspace-board').boundingBox();
    let sideBox = await page.locator('.workspace-rail').boundingBox();
    expect(mainBox).not.toBeNull();

    if (viewport.name === 'desktop' && mainBox && sideBox) {
      expect(mainBox.x + mainBox.width).toBeLessThanOrEqual(sideBox.x + 1);
    }

    if (viewport.name === 'mobile' && !sideBox) {
      await page.getByRole('button', { name: 'Einkauf', exact: true }).click();
      sideBox = await page.locator('.workspace-rail').boundingBox();
    }

    if (viewport.name !== 'desktop' && mainBox && sideBox) {
      expect(sideBox.y).toBeGreaterThanOrEqual(mainBox.y - 1);
    }

    if (viewport.name === 'mobile') {
      const menu = page.getByLabel('Bereiche wechseln');
      const minimumPaneWidth = viewport.size.width - 80;
      await expect(menu).toBeVisible();
      await page.getByRole('button', { name: 'Plan', exact: true }).click();
      await expect(page.locator('.workspace-board')).toBeVisible();
      await expect(page.locator('.workspace-rail-pane').nth(0)).toBeHidden();
      await expect(page.locator('.workspace-shopping-pane')).toBeHidden();
      const planPaneBox = await page.locator('.meal-board-surface').boundingBox();
      expect(planPaneBox?.width ?? 0).toBeGreaterThan(minimumPaneWidth);
      await expect(page.getByRole('button', { name: 'Einkauf', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Einkauf', exact: true }).click();
      await expect(page.locator('.workspace-board')).toBeHidden();
      await expect(page.locator('.workspace-rail-pane').nth(0)).toBeHidden();
      await expect(page.locator('.workspace-shopping-pane')).toBeVisible();
      const shoppingPaneBox = await page.locator('.shopping-list-panel').boundingBox();
      expect(shoppingPaneBox?.width ?? 0).toBeGreaterThan(minimumPaneWidth);
      await page.getByRole('button', { name: 'Rezept', exact: true }).click();
      await expect(page.locator('.workspace-board')).toBeHidden();
      await expect(page.locator('.workspace-rail-pane').nth(0)).toBeVisible();
      await expect(page.locator('.workspace-shopping-pane')).toBeHidden();
      const recipePaneBox = await page.locator('.inspector').boundingBox();
      expect(recipePaneBox?.width ?? 0).toBeGreaterThan(minimumPaneWidth);
      await page.evaluate(() => window.scrollTo({ top: 720, behavior: 'auto' }));
      await page.waitForTimeout(180);
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    }
  }
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
  await expect(page.getByRole('heading', { name: 'Mahlio' })).toBeVisible();
  await expect(page.getByText('Bringt eure Woche an einen Tisch.')).toBeVisible();
  await expect(page.getByLabel('E-Mail')).toBeVisible();

  authenticated = true;
  await page.goto('/family/invites/accept?token=invite-token');
  await page.getByRole('button', { name: 'Familienkonto beitreten' }).click();
  await expect(page).toHaveURL(/\/onboarding\?family=joined$/);
  await expect(page.getByText('Was eure Familie gern isst')).toBeVisible();
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
          label: 'Sonntag',
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
          label: 'Montag',
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
