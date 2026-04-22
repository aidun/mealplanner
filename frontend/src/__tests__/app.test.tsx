import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { ShoppingListPanel } from '../components/ShoppingListPanel';
import styles from '../styles.css?raw';

const profile = {
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
};

const plan = {
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
          meta: { favoriteReuse: 'direct', favoriteTitle: 'Pasta mit Gemüse' },
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
};

const baseDay = plan.days[0]!;
const baseMeal = baseDay.meals[0]!;

const regeneratedPlan = {
  ...plan,
  days: [
    {
      ...baseDay,
      meals: [
        {
          ...baseMeal,
          title: 'Cremige Gemüsepasta',
          description: 'Mit extra Gemüse und mild gewürzt.',
        },
      ],
    },
  ],
};

const shoppingList = [{ name: 'Zucchini', amount: 2, unit: 'Stk', category: 'Gemüse' }];
const favorites = [{ id: 'favorite-meal-2', meal: plan.days[1]!.meals[0]! }];
const family = {
  id: 'family-1',
  name: 'Familie Weber',
  memberCount: 2,
  members: [
    { id: 'anna', name: 'Anna', alias: 'Mama' },
    { id: 'ben', name: 'Ben', alias: 'Ben' },
  ],
  accounts: [
    {
      userId: 'user-1',
      email: 'anna@example.test',
      role: 'owner',
      linkedMemberId: 'anna',
      settings: { weeklyPlanEmailEnabled: true, recipeEmailEnabled: true },
    },
    {
      userId: 'user-2',
      email: 'ben@example.test',
      role: 'member',
      linkedMemberId: 'ben',
      settings: { weeklyPlanEmailEnabled: false, recipeEmailEnabled: true },
    },
  ],
  personal: false,
};
const session = { authenticated: true, csrfToken: 'csrf-token-1', email: 'anna@example.test', isAdmin: false };
const adminOverview = {
  premiumUsers: [{ id: 'premium-1', email: 'premium@example.test' }],
  mailTemplates: [
    {
      kind: 'premium-invite',
      label: 'Premium-Einladung',
      subject: 'Premium für dein Familienkonto',
      textBody: 'Hallo {{email}}',
      htmlBody: '<p>Hallo {{email}}</p>',
      description: 'Wird nach Premium-Freigabe verschickt.',
      variableHint: ['{{email}}', '{{invite_link}}'],
    },
    {
      kind: 'family-invite',
      label: 'Familien-Einladung',
      subject: 'Einladung ins Familienkonto',
      textBody: 'Komm in die Familie',
      htmlBody: '<p>Komm in die Familie</p>',
    },
    {
      kind: 'weekly-cron',
      label: 'Wochenplan-Mail',
      subject: 'Dein Wochenplan ist da',
      textBody: 'Die Woche ist fertig',
      htmlBody: '<p>Die Woche ist fertig</p>',
    },
  ],
  feedback: [{ id: 'feedback-1', message: 'Die Auswahl im Profil ist zu versteckt.', page: '/onboarding', status: 'open', createdAt: '2026-04-21T09:30:00Z' }],
  resolvedFeedback: [{ id: 'feedback-2', message: 'Header auf Mobile verdichten.', page: '/', status: 'resolved', createdAt: '2026-04-20T09:30:00Z', resolvedAt: '2026-04-21T10:30:00Z' }],
  stats: {
    averageActiveAccountsPerFamily: 1.5,
    averageProfileMembersPerFamily: 2.5,
    familyDistributionByAccounts: [
      { label: '1', count: 1 },
      { label: '2', count: 2 },
    ],
    familyDistributionByMembers: [
      { label: '2', count: 1 },
      { label: '3', count: 1 },
    ],
    generations: [
      { category: 'weekly_cron', count: 3 },
      { category: 'regenerate_dinner', count: 5 },
    ],
  },
};
const providers = {
  providers: [
    { id: 'google', name: 'Google', enabled: true, startUrl: '/api/auth/google/start' },
    { id: 'apple', name: 'Apple', enabled: false, startUrl: '/api/auth/apple/start' },
  ],
};

function renderApp(initialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  window.localStorage.clear();
  vi.spyOn(window, 'open').mockImplementation(() => null);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });

  vi.stubGlobal('fetch', createFetchMock());
});

function createFetchMock(options: {
  authenticated?: boolean;
  familyOverride?: typeof family;
  profileOverride?: typeof profile;
  isAdmin?: boolean;
  inviteEmailSent?: boolean;
} = {}) {
  const authenticated = options.authenticated ?? true;
  const activeFamily = options.familyOverride ?? family;
  const activeProfile = options.profileOverride ?? profile;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith('/api/session')) {
      return new Response(
        JSON.stringify(
          authenticated
            ? { ...session, isAdmin: options.isAdmin ?? false, isPremium: options.isAdmin ? false : true }
            : { authenticated: false }
        ),
        { status: 200 }
      );
    }

    if (url.endsWith('/api/auth/providers')) {
      return new Response(JSON.stringify(providers), { status: 200 });
    }

    if (url.endsWith('/api/auth/google/start') && init?.method === 'POST') {
      return new Response(JSON.stringify({ redirectUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=test-state' }), { status: 200 });
    }

    if (url.endsWith('/api/auth/logout') && init?.method === 'POST') {
      return new Response(null, { status: 204 });
    }

    if (url.endsWith('/api/feedback') && init?.method === 'POST') {
      const payload = JSON.parse(String(init.body ?? '{}'));
      return new Response(JSON.stringify({ id: 'feedback-new', message: payload.message, page: payload.page, status: 'open' }), { status: 201 });
    }

    if (url.endsWith('/api/profile') && (!init || !init.method || init.method === 'GET')) {
      return new Response(JSON.stringify(activeProfile), { status: 200 });
    }

    if (url.endsWith('/api/plans/current')) {
      return new Response(JSON.stringify(plan), { status: 200 });
    }

    if (url.endsWith('/api/plans/plan-1/shopping-list')) {
      return new Response(JSON.stringify(shoppingList), { status: 200 });
    }

    if (url.endsWith('/api/family') && (!init || !init.method || init.method === 'GET')) {
      return new Response(JSON.stringify(activeFamily), { status: 200 });
    }

    if (url.endsWith('/api/favorites') && (!init || !init.method || init.method === 'GET')) {
      return new Response(JSON.stringify(favorites), { status: 200 });
    }

    if (url.endsWith('/api/favorites') && init?.method === 'POST') {
      return new Response(JSON.stringify({ id: 'favorite-meal-1', meal: baseMeal }), { status: 201 });
    }

    if (url.includes('/api/favorites/') && init?.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }

    if (url.endsWith('/api/family/invites') && init?.method === 'POST') {
      return new Response(
        JSON.stringify({
          id: 'invite-1',
          inviteLink: 'https://mealplanner.test/family/invites/accept?token=invite-token',
          emailSent: options.inviteEmailSent ?? true,
          expiresAt: '2026-04-28T00:00:00Z',
          warningText: 'Der persönliche Account geht im Familienkonto auf.',
        }),
        { status: 201 }
      );
    }

    if (url.endsWith('/api/family/invites/accept') && init?.method === 'POST') {
      return new Response(JSON.stringify(activeFamily), { status: 200 });
    }

    if (url.endsWith('/api/family/member-links') && init?.method === 'PUT') {
      return new Response(JSON.stringify(activeFamily), { status: 200 });
    }

    if (url.endsWith('/api/family/account-settings') && init?.method === 'PUT') {
      return new Response(JSON.stringify(activeFamily), { status: 200 });
    }

    if (url.endsWith('/api/debug/prompts/latest')) {
      return new Response(
        JSON.stringify({
          latest: {
            operation: 'generate_week',
            model: 'gpt-5.4-mini',
            prompt: 'Familienprofil:\\nprivater Haushalt',
            meta: { promptVersion: '2026-04-21', requestedWeekStart: '2026-04-13', members: '2', favorites: '1' },
          },
          recent: [
            {
              operation: 'generate_week',
              model: 'gpt-5.4-mini',
              prompt: 'Familienprofil:\\nprivater Haushalt',
              meta: { promptVersion: '2026-04-21', requestedWeekStart: '2026-04-13', members: '2', favorites: '1' },
              createdAt: '2026-04-21T09:00:00Z',
            },
            { operation: 'regenerate_meal', model: 'gpt-5.4-mini', prompt: 'Regeneration', meta: { mealID: 'meal-1' }, createdAt: '2026-04-21T08:00:00Z' },
          ],
          openai: {
            requests: [{ operation: 'generate_week', model: 'gpt-5.4-mini', status: 'success', count: 2, durationSum: 1.4 }],
            tokens: [{ operation: 'generate_week', model: 'gpt-5.4-mini', type: 'total', count: 640 }],
          },
        }),
        { status: 200 }
      );
    }

    if (url.includes('/api/admin/overview')) {
      return new Response(JSON.stringify(adminOverview), { status: 200 });
    }

    if (url.includes('/api/admin/feedback/') && init?.method === 'POST') {
      return new Response(JSON.stringify({ id: 'feedback-1', message: 'Die Auswahl im Profil ist zu versteckt.', page: '/onboarding', status: 'resolved' }), { status: 200 });
    }

    if (url.endsWith('/api/admin/mail-templates')) {
      return new Response(JSON.stringify(adminOverview.mailTemplates), { status: 200 });
    }

    if (url.endsWith('/api/admin/premium-users') && init?.method === 'POST') {
      const payload = JSON.parse(String(init.body ?? '{}'));
      return new Response(JSON.stringify({ id: 'premium-new', email: payload.email, inviteSent: Boolean(payload.sendInvite) }), { status: 201 });
    }

    if (url.includes('/api/admin/premium-users/') && init?.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }

    if (url.includes('/api/admin/mail-templates/') && init?.method === 'PUT') {
      const payload = JSON.parse(String(init.body ?? '{}'));
      const kind = url.split('/').pop();
      return new Response(JSON.stringify({ kind, ...payload }), { status: 200 });
    }

    if (url.includes('/api/plans/plan-1/bring-export-url')) {
      const suffix = url.includes('?') ? `?${url.split('?')[1]}` : '';
      const pageUrl = `/api/plans/plan-1/bring-export${suffix}${suffix ? '&' : '?'}token=test-token`;
      return new Response(JSON.stringify({ url: `https://enjoy.getbring.com/ZAzR${suffix}${suffix ? '&' : '?'}token=test-token`, pageUrl }), {
        status: 200,
      });
    }

    if (url.includes('/regenerate')) {
      return new Response(JSON.stringify(regeneratedPlan), { status: 200 });
    }

    if (url.endsWith('/api/plans') && init?.method === 'POST') {
      return new Response(JSON.stringify(plan), { status: 200 });
    }

    if (url.endsWith('/api/profile') && init?.method === 'PUT') {
      return new Response(JSON.stringify(profile), { status: 200 });
    }

    return new Response('', { status: 404 });
  }) as unknown as typeof fetch;
}

describe('Mealplanner app', () => {
  it('shows the prompt debug overlay in the test environment', async () => {
    vi.stubEnv('VITE_PROMPT_DEBUG', 'true');
    window.localStorage.setItem('mealplanner.promptDebug', 'true');
    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Prompt prüfen' }));

    expect(await screen.findByLabelText('Prompt Debug Overlay')).toBeInTheDocument();
    expect(screen.getAllByText('generate_week').length).toBeGreaterThan(0);
    expect(screen.getByText(/Familienprofil/)).toBeInTheDocument();
    expect(screen.getByText('OpenAI Tokens')).toBeInTheDocument();
    expect(screen.getByText('Diagnose')).toBeInTheDocument();
    expect(screen.getByText('Kontext')).toBeInTheDocument();
    expect(screen.getByText('Prompt-Version')).toBeInTheDocument();
    expect(screen.getByText('Angefragter Start')).toBeInTheDocument();
    expect(screen.getByText('2026-04-13')).toBeInTheDocument();
    expect(screen.getByText('0.70s')).toBeInTheDocument();
  });

  it('shows the login page without a session and only enabled providers', async () => {
    vi.stubGlobal('fetch', createFetchMock({ authenticated: false }));

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Mahlio' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Mit Google anmelden' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mit Apple anmelden' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Impressum' })).toBeInTheDocument();
  });

  it('renders disabled Google login as a disabled button, not a link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/session')) {
          return new Response(JSON.stringify({ authenticated: false }), { status: 200 });
        }
        if (url.endsWith('/api/auth/providers')) {
          return new Response(JSON.stringify({ providers: [{ id: 'google', name: 'Google', enabled: false }] }), {
            status: 200,
          });
        }
        return new Response('', { status: 404 });
      }) as unknown as typeof fetch
    );

    renderApp('/');

    expect(await screen.findByRole('button', { name: 'Mit Google anmelden' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Mit Google anmelden' })).not.toBeInTheDocument();
  });

  it('falls back to same-origin auth paths when provider start urls are unsafe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/session')) {
          return new Response(JSON.stringify({ authenticated: false }), { status: 200 });
        }
        if (url.endsWith('/api/auth/providers')) {
          return new Response(
            JSON.stringify({
              providers: [
                { id: 'google', name: 'Google', enabled: true, startUrl: 'https://evil.example/login' },
                { id: 'apple', name: 'Apple', enabled: true, startUrl: '//evil.example/apple' },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response('', { status: 404 });
      }) as unknown as typeof fetch
    );

    renderApp('/');

    expect(await screen.findByRole('button', { name: 'Mit Google anmelden' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Mit Apple anmelden' })).toHaveAttribute(
      'href',
      '/api/auth/apple/start'
    );
  });

  it('renders the weekly board and shopping list', async () => {
    const fetchMock = vi.mocked(fetch);
    renderApp('/');

    expect(await screen.findByText('Diese Woche auf dem Tisch')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Haushalt' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Wochenplan erstellen/i })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: /Direkt zwischen Woche, Gericht und Einkauf wechseln/i })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/session'))).toHaveLength(1);
    const mealButton = (await screen.findAllByRole('button', { name: /Pasta mit Gemüse/ }))[0]!;
    expect(mealButton).toBeInTheDocument();
    expect(within(mealButton).queryByText('Familienfreundlich und schnell.')).not.toBeInTheDocument();
    expect(await screen.findByText('Familienfreundlich und schnell.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rezeptkontext anzeigen' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rezeptkontext anzeigen' }));
    expect(screen.getByText(/wurde aus eurer Favoriten-Sammlung wieder aufgegriffen/i)).toBeInTheDocument();
    expect(screen.getByText(/Herkunft:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Warum ausgewählt anzeigen' }));
    expect(screen.getByText(/Es wurde aus eurer gespeicherten Sammlung wieder aufgenommen./)).toBeInTheDocument();
    expect(await screen.findByText('Einkaufsliste')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Woche zu Bring' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Tag zu Bring' })).toHaveAttribute(
      'href',
      expect.stringContaining('/api/plans/plan-1/bring-export?day=2026-04-13')
    );
    expect(await screen.findByRole('link', { name: 'Rezept zu Bring' })).toHaveAttribute(
      'href',
      expect.stringContaining('/api/plans/plan-1/bring-export?day=2026-04-13&meal=meal-1')
    );
    expect(screen.getAllByText(/pro Portion/).length).toBeGreaterThan(0);
    expect(screen.getByText('Die Aufteilung ist nicht gleichmäßig. Nährwerte beziehen sich auf die angegebene Portion.')).toBeInTheDocument();
    expect(screen.getByText(/392 kcal/)).toBeInTheDocument();
    expect(screen.getByText('1 Artikel · 1 Bereiche')).toBeInTheDocument();
    expect(screen.getByText('Zucchini')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Liste aufklappen' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Liste aufklappen' }));
    expect(screen.getByText(/Vor dem Einkauf prüfen/)).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Premium Feedback' })).toBeInTheDocument();
  });

  it('keeps the premium feedback box collapsed by default', async () => {
    renderApp('/');

    expect(await screen.findByRole('complementary', { name: 'Premium Feedback' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Feedback' })).not.toBeInTheDocument();
  });

  it('sends premium feedback with page context', async () => {
    const fetchMock = vi.mocked(fetch);
    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: /Feedback/i }));
    await userEvent.type(await screen.findByRole('textbox', { name: 'Feedback' }), 'Die Tagesauswahl braucht mehr Kontext.');
    fireEvent.click(screen.getByRole('button', { name: 'Feedback senden' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/feedback'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: 'Die Tagesauswahl braucht mehr Kontext.', page: '/?meal=meal-1&day=2026-04-13' }),
        })
      )
    );
    expect(await screen.findByText(/Feedback gespeichert/)).toBeInTheDocument();
  });

  it('renders the Bring export as a direct link without opening a popup', async () => {
    renderApp('/');

    const bringLink = await screen.findByRole('link', { name: 'Woche zu Bring' });

    expect(bringLink).toHaveAttribute('href', expect.stringContaining('/api/plans/plan-1/bring-export?token=test-token'));
    expect(bringLink).toHaveAttribute('target', '_blank');
    expect(bringLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('marks and removes recipe favorites', async () => {
    const fetchMock = vi.mocked(fetch);
    renderApp('/');

    const addButton = await screen.findByRole('button', { name: 'Als Favorit merken' });
    fireEvent.click(addButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/favorites'),
        expect.objectContaining({ method: 'POST' })
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() => expect(screen.getAllByText('Beeren-Porridge').length).toBeGreaterThan(0));
    const removeButton = await screen.findByRole('button', { name: 'Favorit entfernen' });
    fireEvent.click(removeButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/favorites/favorite-meal-2'),
        expect.objectContaining({ method: 'DELETE' })
      )
    );
  });

  it('shows favorites inside the profile area', async () => {
    renderApp('/onboarding');

    fireEvent.click(await screen.findByRole('button', { name: 'Favoriten' }));
    expect(await screen.findByText(/1 gespeicherte Rezepte|gespeicherte Rezepte/)).toBeInTheDocument();
    expect(screen.getByText('Beeren-Porridge')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /entfernen/i }).length).toBeGreaterThan(0);
  });

  it('reads the active profile tab from the url', async () => {
    renderApp('/onboarding?tab=favorites');

    expect(await screen.findByRole('heading', { name: 'Favoriten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Favoriten' })).toHaveClass('profile-tab-button-active');
  });

  it('keeps the weekly Bring link stable when shopping list contents change', async () => {
    let exportCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/plans/plan-1/bring-export-url')) {
        exportCalls += 1;
        return new Response(JSON.stringify({ url: `https://enjoy.getbring.com/ZAzR?token=${exportCalls}`, pageUrl: `/api/plans/plan-1/bring-export?token=${exportCalls}` }), {
          status: 200,
        });
      }
      return new Response('', { status: 404 });
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(
      <ShoppingListPanel planId="plan-1" shoppingList={[{ name: 'Zucchini', amount: 2, unit: 'Stk' }]} loading={false} />
    );
    expect(await screen.findByRole('link', { name: 'Woche zu Bring' })).toHaveAttribute(
      'href',
      '/api/plans/plan-1/bring-export?token=1'
    );

    rerender(
      <ShoppingListPanel
        planId="plan-1"
        shoppingList={[{ name: 'Zucchini', amount: 3, unit: 'Stk' }]}
        loading={false}
      />
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('link', { name: 'Woche zu Bring' })).toHaveAttribute(
      'href',
      '/api/plans/plan-1/bring-export?token=1'
    );
  });

  it('moves through days as a carousel', async () => {
    renderApp('/');

    expect((await screen.findAllByRole('button', { name: /Pasta mit Gemüse/ })).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect((await screen.findAllByRole('button', { name: /Beeren-Porridge/ })).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('button', { name: /Pasta mit Gemüse/ })).toHaveLength(0);
  });

  it('reads dashboard focus from the url', async () => {
    renderApp('/?pane=shopping&day=2026-04-14&meal=meal-2');

    expect(await screen.findByText('Diese Woche auf dem Tisch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Einkauf' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Di')).toBeInTheDocument();
  });

  it('shows the updated meal after regeneration', async () => {
    renderApp('/');

    fireEvent.change(await screen.findByLabelText('Wunsch zur Änderung'), {
      target: { value: 'mehr Gemüse' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gericht austauschen' }));

    await waitFor(() => {
      expect(screen.getAllByText('Cremige Gemüsepasta').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Das Gericht wurde ausgetauscht.')).toBeInTheDocument();
  });

  it('keeps the Bring export button mobile friendly', () => {
    expect(styles).toContain('.bring-export-button');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('@media (max-width: 760px)');
    expect(styles).toContain('@media (max-width: 1320px)');
    expect(styles).toContain('.workspace-main > *,\n.workspace-side > * {\n  min-width: 0;');
    expect(styles).toContain('.surface-actions,\n  .bring-export-button {\n    width: 100%;');
    expect(styles).toContain('.board-carousel');
    expect(styles).toContain('.day-tabs');
    expect(styles).toContain('.workspace-pane-switch');
  });

  it('opens onboarding and saves the profile', async () => {
    renderApp('/onboarding');

    expect(await screen.findByText('Haushalt und Familie pflegen')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Haushaltsname'), { target: { value: 'Familie Weber' } });
    fireEvent.change(screen.getAllByLabelText('Anrede im Plan')[0]!, { target: { value: 'Mama' } });
    fireEvent.change(screen.getByLabelText('Standard-Portionen'), { target: { value: '4' } });
    const mondayCard = screen.getByLabelText('Montag');
    fireEvent.click(within(mondayCard).getByLabelText('Snack'));
    fireEvent.click(within(screen.getByLabelText('Montag Snack Teilnehmende')).getByLabelText('Ben'));

    fireEvent.click(screen.getByRole('button', { name: 'Angaben speichern' }));

    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/profile'),
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
            body: expect.stringContaining('Aktive Mahlzeiten Montag'),
          })
        );
    });
    await waitFor(() => {
      expect(screen.getAllByText('Angaben gespeichert. Der nächste Wochenplan nutzt diese Einstellungen.').length).toBeGreaterThan(0);
    });
  });

  it('shows the admin link in the header only for the configured admin account', async () => {
    vi.stubGlobal('fetch', createFetchMock({ isAdmin: true }));

    renderApp('/');

    expect(await screen.findByRole('complementary', { name: 'Premium Feedback' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('link', { name: 'Admin' }));
    expect(await screen.findByRole('heading', { name: 'Admin' })).toBeInTheDocument();
    expect(await screen.findByText('premium@example.test')).toBeInTheDocument();
    expect(await screen.findByText('Premium-Einladung')).toBeInTheDocument();
    expect(await screen.findByText('weekly_cron')).toBeInTheDocument();
    expect(await screen.findByText('Die Auswahl im Profil ist zu versteckt.')).toBeInTheDocument();
    expect(await screen.findByText('Archiv')).toBeInTheDocument();
  });

  it('marks admin feedback as resolved and removes it from the open list', async () => {
    vi.stubGlobal('fetch', createFetchMock({ isAdmin: true }));
    renderApp('/admin');

    expect(await screen.findByText('Die Auswahl im Profil ist zu versteckt.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Als gelöst markieren' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/feedback/feedback-1/resolve'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
        })
      );
    });
    expect(await screen.findByText('Feedback als gelöst markiert.')).toBeInTheDocument();
  });

  it('creates a family invite link from onboarding', async () => {
    renderApp('/onboarding');

    fireEvent.click(await screen.findByRole('button', { name: 'Einladungen' }));
    expect(await screen.findByRole('heading', { name: 'Einladungen' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('E-Mail-Adresse für Einladung'), {
      target: { value: 'person@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Einladung per E-Mail senden' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/family/invites'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
          body: JSON.stringify({ email: 'person@example.test' }),
        })
      );
    });
    expect(await screen.findByText('https://mealplanner.test/family/invites/accept?token=invite-token')).toBeInTheDocument();
    expect(screen.getByText(/Die Einladung wurde per E-Mail verschickt/i)).toBeInTheDocument();
    expect(screen.getByText(/persönliche Account geht im Familienkonto auf/i)).toBeInTheDocument();
    expect(screen.getAllByText('anna@example.test').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('Mama').length).toBeGreaterThan(0);
    expect(screen.getByText(/von 2 Logins zugeordnet/i)).toBeInTheDocument();
  });

  it('shows a manual-share fallback when invite email delivery fails', async () => {
    vi.stubGlobal('fetch', createFetchMock({ inviteEmailSent: false }));

    renderApp('/onboarding');

    fireEvent.click(await screen.findByRole('button', { name: 'Einladungen' }));
    fireEvent.change(screen.getByLabelText('E-Mail-Adresse für Einladung'), {
      target: { value: 'person@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Einladung per E-Mail senden' }));

    expect(await screen.findByText(/Der Link ist bereit\. Die E-Mail konnte gerade nicht verschickt werden\./i)).toBeInTheDocument();
    expect(screen.getByText('https://mealplanner.test/family/invites/accept?token=invite-token')).toBeInTheDocument();
  });

  it('shows merged family members with visible login mails', async () => {
    renderApp('/onboarding');

    expect(await screen.findByLabelText('Wer gehört zum Familienkonto')).toBeInTheDocument();
    expect(await screen.findAllByText('anna@example.test')).not.toHaveLength(0);
    expect(screen.getAllByText('ben@example.test').length).toBeGreaterThan(0);
  });

  it('keeps family assignments visible when family members arrive from family summary', async () => {
    vi.stubGlobal(
      'fetch',
      createFetchMock({
        profileOverride: {
          ...profile,
          members: [],
        },
      })
    );

    renderApp('/onboarding');

    expect(await screen.findByText('Verknüpft mit Mama')).toBeInTheDocument();
    expect(screen.getByText('Verknüpft mit Ben')).toBeInTheDocument();
  });

  it('highlights unassigned family accounts', async () => {
    vi.stubGlobal(
      'fetch',
      createFetchMock({
        familyOverride: {
          ...family,
          accounts: [
            {
              userId: 'user-3',
              email: 'alex@example.test',
              role: 'member',
              linkedMemberId: '',
              settings: { weeklyPlanEmailEnabled: false, recipeEmailEnabled: false },
            },
          ],
        },
      })
    );

    renderApp('/onboarding');

    expect((await screen.findAllByText(/Logins brauchen noch eine Person/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Zuordnung offen').length).toBeGreaterThan(0);
  });

  it('shows specific feedback after linking a family account', async () => {
    renderApp('/onboarding');

    const selects = await screen.findAllByLabelText('Zugeordnete Person');
    fireEvent.change(selects[1]!, { target: { value: 'anna' } });

    expect(await screen.findByText('ben@example.test wurde aktualisiert.')).toBeInTheDocument();
  });

  it('saves unsaved profile edits before linking a login to a person', async () => {
    renderApp('/onboarding');

    const aliasFields = await screen.findAllByLabelText('Anrede im Plan');
    fireEvent.change(aliasFields[0]!, { target: { value: 'Mama Neu' } });
    const selects = await screen.findAllByLabelText('Zugeordnete Person');
    fireEvent.change(selects[1]!, { target: { value: 'anna' } });

    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
      expect(calls.find((url) => url.includes('/api/profile'))).toBeTruthy();
      expect(calls.find((url) => url.includes('/api/family/member-links'))).toBeTruthy();
    });
    expect(await screen.findByText(/wurde aktualisiert/i)).toBeInTheDocument();
  });

  it('stores per-account mail settings from the family profile area', async () => {
    renderApp('/onboarding');

    const weeklyPlanToggles = await screen.findAllByRole('checkbox', { name: 'Wochenplan-Mail' });
    fireEvent.click(weeklyPlanToggles[1]!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/family/account-settings'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
          body: JSON.stringify({
            accountUserId: 'user-2',
            settings: { weeklyPlanEmailEnabled: true, recipeEmailEnabled: true },
          }),
        })
      );
    });
    expect(await screen.findByText('Mail-Einstellungen gespeichert.')).toBeInTheDocument();
  });

  it('creates a premium user and sends an invite mail from admin', async () => {
    vi.stubGlobal('fetch', createFetchMock({ isAdmin: true }));
    renderApp('/admin');

    fireEvent.change(await screen.findByLabelText('Premium-Mail freigeben'), {
      target: { value: 'new@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/premium-users'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
          body: JSON.stringify({ email: 'new@example.test', sendInvite: true }),
        })
      );
    });
    expect(await screen.findByText('Premium freigeschaltet und Einladung versendet.')).toBeInTheDocument();
  });

  it('saves editable mail templates from admin', async () => {
    vi.stubGlobal('fetch', createFetchMock({ isAdmin: true }));
    renderApp('/admin');

    const subjectField = await screen.findByDisplayValue('Premium für dein Familienkonto');
    fireEvent.change(subjectField, { target: { value: 'Neue Premium-Einladung' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Template speichern' })[0]!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/mail-templates/premium-invite'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
          body: JSON.stringify({
            subject: 'Neue Premium-Einladung',
            textBody: 'Hallo {{email}}',
            htmlBody: '<p>Hallo {{email}}</p>',
          }),
        })
      );
    });
    expect(await screen.findByText('Mail-Template gespeichert.')).toBeInTheDocument();
  });

  it('copies the invite link from onboarding', async () => {
    renderApp('/onboarding');

    fireEvent.click(await screen.findByRole('button', { name: 'Einladungen' }));
    fireEvent.change(await screen.findByLabelText('E-Mail-Adresse für Einladung'), {
      target: { value: 'person@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Einladung per E-Mail senden' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Einladungslink kopieren' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://mealplanner.test/family/invites/accept?token=invite-token'
      );
    });
    expect(screen.getByRole('button', { name: 'Einladungslink kopiert' })).toBeInTheDocument();
  });

  it('accepts an invite and lands on the merged family profile', async () => {
    renderApp('/family/invites/accept?token=invite-token');

    fireEvent.click(await screen.findByRole('button', { name: 'Familienkonto beitreten' }));

    expect(await screen.findByText(/Familienbereich aktiv\./)).toBeInTheDocument();
    expect(await screen.findByText('Haushalt und Familie pflegen')).toBeInTheDocument();
  });

  it('shows feedback when plan generation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/session')) {
          return new Response(JSON.stringify(session), { status: 200 });
        }
        if (url.endsWith('/api/profile')) {
          return new Response(JSON.stringify(profile), { status: 200 });
        }
        if (url.endsWith('/api/plans/current')) {
          return new Response('', { status: 404 });
        }
        if (url.endsWith('/api/plans') && init?.method === 'POST') {
          return new Response(JSON.stringify({ error: 'Das hat gerade nicht geklappt. Bitte versuche es erneut.', requestId: 'req-123' }), {
            status: 500,
          });
        }
        return new Response('', { status: 404 });
      }) as unknown as typeof fetch
    );

    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: /Wochenplan erstellen/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Das hat gerade nicht geklappt. Bitte versuche es erneut. Fehler-ID: req-123'
    );
  });

  it('sends a note when regenerating a meal', async () => {
    renderApp('/');

    const user = userEvent.setup();
    expect((await screen.findAllByRole('button', { name: /Pasta mit Gemüse/ })).length).toBeGreaterThan(0);
    const noteField = screen.getByLabelText('Wunsch zur Änderung');
    await user.click(noteField);
    await user.type(noteField, 'Weniger Salz, mehr Gemüse.');
    fireEvent.click(screen.getByRole('button', { name: 'Gericht austauschen' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/plans/plan-1/meals/meal-1/regenerate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
          body: JSON.stringify({ note: 'Weniger Salz, mehr Gemüse.' }),
        })
      );
    });
  });

  it('covers the main planner smoke path', async () => {
    renderApp('/');

    fireEvent.click((await screen.findAllByRole('button', { name: /Wochenplan erstellen/i }))[0]!);
    expect((await screen.findAllByRole('button', { name: /Pasta mit Gemüse/ })).length).toBeGreaterThan(0);

    fireEvent.click((await screen.findAllByRole('button', { name: /Pasta mit Gemüse/ }))[0]!);
    fireEvent.change(screen.getByLabelText('Wunsch zur Änderung'), {
      target: { value: 'Bitte schneller und mit mehr Gemüse.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gericht austauschen' }));
    await waitFor(() => expect(screen.getAllByText('Cremige Gemüsepasta').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'Als Favorit merken' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/favorites'),
        expect.objectContaining({ method: 'POST' })
      )
    );

    expect(screen.getByRole('link', { name: 'Rezept zu Bring' })).toHaveAttribute(
      'href',
      expect.stringContaining('/api/plans/plan-1/bring-export')
    );
  });

  it('logs out and returns to the login page', async () => {
    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Abmelden' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
        })
      );
    });
    expect(await screen.findByRole('button', { name: 'Mit Google anmelden' })).toBeInTheDocument();
  });

  it('keeps the dashboard visible when logout fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/session')) {
          return new Response(JSON.stringify(session), { status: 200 });
        }
        if (url.endsWith('/api/profile')) {
          return new Response(JSON.stringify(profile), { status: 200 });
        }
        if (url.endsWith('/api/plans/current')) {
          return new Response(JSON.stringify(plan), { status: 200 });
        }
        if (url.endsWith('/api/plans/plan-1/shopping-list')) {
          return new Response(JSON.stringify(shoppingList), { status: 200 });
        }
        if (url.includes('/api/plans/plan-1/bring-export-url')) {
          return new Response(JSON.stringify({ url: 'https://enjoy.getbring.com/ZAzR?token=test-token', pageUrl: '/api/plans/plan-1/bring-export?token=test-token' }), {
            status: 200,
          });
        }
        if (url.endsWith('/api/auth/logout') && init?.method === 'POST') {
          return new Response(JSON.stringify({ error: 'logout failed' }), { status: 500 });
        }
        return new Response('', { status: 404 });
      }) as unknown as typeof fetch
    );

    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Abmelden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Logout gerade nicht möglich');
    expect(screen.getByText('Diese Woche in Mahlio.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mit Google anmelden' })).not.toBeInTheDocument();
  });

  it('renders legal pages with explicit review status', async () => {
    renderApp('/datenschutz');

    expect(await screen.findByRole('heading', { name: 'Datenschutz' })).toBeInTheDocument();
    expect(screen.getByText('Rechtliches')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Verantwortlicher' })).toBeInTheDocument();
    expect(screen.getByText('Markus Hartmann')).toBeInTheDocument();
    expect(screen.getByText('56323 Waldesch, Deutschland')).toBeInTheDocument();
    expect(screen.getByText('Kontakt: info@markushartmann.dev')).toBeInTheDocument();

    renderApp('/impressum');

    expect(await screen.findByRole('heading', { name: 'Impressum' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Anbieterkennzeichnung' })).toBeInTheDocument();
    expect(screen.getByText('E-Mail: info@markushartmann.dev')).toBeInTheDocument();
  });

  it('does not expose prompt debug from local storage in production builds', async () => {
    vi.stubEnv('VITE_PROMPT_DEBUG', 'false');
    window.localStorage.setItem('mealplanner.promptDebug', 'true');
    renderApp('/');

    expect(await screen.findByText('Diese Woche in Mahlio.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prompt prüfen' })).not.toBeInTheDocument();
  });

  it('shows allergy guidance in the profile settings', async () => {
    renderApp('/onboarding');

    expect(await screen.findByText(/Allergien und Unverträglichkeiten werden in Rezepten nicht verbindlich geprüft/)).toBeInTheDocument();
    expect(screen.getByText(/Mahlio Rezepte nicht als rechtssicheren Allergie-Check/)).toBeInTheDocument();
  });
});
