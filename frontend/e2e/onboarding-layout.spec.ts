import { expect, test, type Locator, type Page } from '@playwright/test';

test('first-login onboarding stays stable from desktop to small mobile', async ({ page }) => {
  const state = createOnboardingState();
  const viewports = [
    { name: 'desktop-large', size: { width: 1440, height: 1100 } },
    { name: 'desktop-small', size: { width: 1280, height: 800 } },
    { name: 'tablet', size: { width: 1024, height: 1180 } },
    { name: 'tablet-small', size: { width: 768, height: 1024 } },
    { name: 'mobile', size: { width: 390, height: 844 } },
    { name: 'mobile-small', size: { width: 320, height: 568 } },
  ];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/session') {
      return route.fulfill(
        json({
          authenticated: true,
          csrfToken: 'csrf-token-1',
          userID: 'user-1',
          email: 'markush1986@gmail.com',
          isAdmin: true,
          onboardingRequired: state.onboardingRequired,
        })
      );
    }
    if (path === '/api/profile' && method === 'GET') return route.fulfill(json(state.profile));
    if (path === '/api/profile' && method === 'PUT') {
      state.profile = JSON.parse(request.postData() ?? '{}');
      state.onboardingRequired = false;
      return route.fulfill(json(state.profile));
    }
    if (path === '/api/family' && method === 'GET') return route.fulfill(json(state.family));
    if (path === '/api/favorites' && method === 'GET') return route.fulfill(json([]));
    if (path === '/api/account/onboarding/skip' && method === 'POST') {
      state.onboardingRequired = false;
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ status: 404, body: '' });
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport.size);
    state.onboardingRequired = true;
    await page.goto('/');

    await expect(page).toHaveURL(/\/onboarding\?welcome=1$/);
    const dialog = page.getByRole('dialog', { name: /Richte euer Kuechenprofil/i });
    await expect(dialog).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertHorizontallyWithinViewport(dialog, page);

    const skipButton = page.getByRole('button', { name: 'Jetzt ueberspringen' });
    const startButton = page.getByRole('button', { name: 'Profil jetzt ausfuellen' });
    await expect(skipButton).toBeVisible();
    await expect(startButton).toBeVisible();
    await expectNoOverlap(skipButton, startButton);

    await startButton.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Haushalt & Küchenprofil' })).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await assertHorizontallyWithinViewport(page.locator('.profile-page-intro'), page);
    const saveBar = page.locator('.profile-save-bar');
    await saveBar.scrollIntoViewIfNeeded();
    await assertHorizontallyWithinViewport(saveBar, page);

    const tabNav = page.locator('.profile-tab-nav');
    await expect(tabNav).toBeVisible();
    const tabOverflow = await tabNav.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(tabOverflow.scrollWidth).toBeLessThanOrEqual(tabOverflow.clientWidth + 1);
  }
});

function createOnboardingState() {
  return {
    onboardingRequired: true,
    profile: {
      householdName: 'Privater Haushalt',
      members: [{ id: 'person-1', name: 'Person 1', alias: 'Person 1', role: 'Erwachsen', likes: '' }],
      defaults: {
        breakfast: 'schnell, familientauglich, nicht zu suess',
        lunch: 'alltagstauglich und gut vorzubereiten',
        dinner: 'gemeinsames warmes Essen',
        snacks: 'nur wenn sinnvoll fuer Kalorienziel oder Alltag',
      },
      presets: ['familientauglich'],
      notes: 'Naehrwerte sind Schaetzungen und nicht medizinisch verbindlich.',
    },
    family: {
      id: 'family-1',
      name: 'Persoenliche Familie',
      memberCount: 1,
      members: [],
      accounts: [{ userId: 'user-1', email: 'markush1986@gmail.com', role: 'owner' }],
      personal: true,
    },
  };
}

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function assertHorizontallyWithinViewport(locator: Locator, page: Page) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
}

async function expectNoOverlap(a: Locator, b: Locator) {
  const [boxA, boxB] = await Promise.all([a.boundingBox(), b.boundingBox()]);
  expect(boxA).not.toBeNull();
  expect(boxB).not.toBeNull();
  if (!boxA || !boxB) return;

  const overlaps =
    boxA.x < boxB.x + boxB.width &&
    boxA.x + boxA.width > boxB.x &&
    boxA.y < boxB.y + boxB.height &&
    boxA.y + boxA.height > boxB.y;

  expect(overlaps).toBe(false);
}
