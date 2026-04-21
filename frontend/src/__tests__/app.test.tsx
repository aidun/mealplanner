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
    { id: 'anna', name: 'Anna', likes: 'Mediterran' },
    { id: 'ben', name: 'Ben', likes: 'Pasta' },
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
const family = { id: 'family-1', name: 'Familie Weber', memberCount: 2, personal: false };
const session = { authenticated: true, csrfToken: 'csrf-token-1' };
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

function createFetchMock(options: { authenticated?: boolean } = {}) {
  const authenticated = options.authenticated ?? true;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith('/api/session')) {
      return new Response(JSON.stringify(authenticated ? session : { authenticated: false }), { status: 200 });
    }

    if (url.endsWith('/api/auth/providers')) {
      return new Response(JSON.stringify(providers), { status: 200 });
    }

    if (url.endsWith('/api/auth/logout') && init?.method === 'POST') {
      return new Response(null, { status: 204 });
    }

    if (url.endsWith('/api/profile') && (!init || !init.method || init.method === 'GET')) {
      return new Response(JSON.stringify(profile), { status: 200 });
    }

    if (url.endsWith('/api/plans/current')) {
      return new Response(JSON.stringify(plan), { status: 200 });
    }

    if (url.endsWith('/api/plans/plan-1/shopping-list')) {
      return new Response(JSON.stringify(shoppingList), { status: 200 });
    }

    if (url.endsWith('/api/family') && (!init || !init.method || init.method === 'GET')) {
      return new Response(JSON.stringify(family), { status: 200 });
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
          expiresAt: '2026-04-28T00:00:00Z',
          warningText: 'Der persönliche Account geht im Familienkonto auf.',
        }),
        { status: 201 }
      );
    }

    if (url.endsWith('/api/family/invites/accept') && init?.method === 'POST') {
      return new Response(JSON.stringify(family), { status: 200 });
    }

    if (url.endsWith('/api/debug/prompts/latest')) {
      return new Response(JSON.stringify({ operation: 'generate_week', prompt: 'Familienprofil:\\nprivater Haushalt' }), {
        status: 200,
      });
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
    window.localStorage.setItem('mealplanner.promptDebug', 'true');
    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Prompt prüfen' }));

    expect(await screen.findByLabelText('Prompt Debug Overlay')).toBeInTheDocument();
    expect(screen.getByText('generate_week')).toBeInTheDocument();
    expect(screen.getByText(/Familienprofil/)).toBeInTheDocument();
  });

  it('shows the login page without a session and only enabled providers', async () => {
    vi.stubGlobal('fetch', createFetchMock({ authenticated: false }));

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Mealplanner' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Mit Google anmelden' })).toHaveAttribute(
      'href',
      '/api/auth/google/start'
    );
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

    expect(await screen.findByRole('link', { name: 'Mit Google anmelden' })).toHaveAttribute(
      'href',
      '/api/auth/google/start'
    );
    expect(await screen.findByRole('link', { name: 'Mit Apple anmelden' })).toHaveAttribute(
      'href',
      '/api/auth/apple/start'
    );
  });

  it('renders the weekly board and shopping list', async () => {
    renderApp('/');

    expect(await screen.findByText('Diese Woche auf dem Tisch')).toBeInTheDocument();
    const mealButton = await screen.findByRole('button', { name: /Pasta mit Gemüse/ });
    expect(mealButton).toBeInTheDocument();
    expect(within(mealButton).queryByText('Familienfreundlich und schnell.')).not.toBeInTheDocument();
    expect(await screen.findByText('Familienfreundlich und schnell.')).toBeInTheDocument();
    expect(await screen.findByText('Einkaufsliste')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Woche zu Bring' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Tag zu Bring' })).toHaveAttribute(
      'href',
      expect.stringContaining('day=2026-04-13')
    );
    expect(await screen.findByRole('link', { name: 'Rezept zu Bring' })).toHaveAttribute(
      'href',
      expect.stringContaining('meal=meal-1')
    );
    expect(screen.getAllByText(/pro Portion/).length).toBeGreaterThan(0);
    expect(screen.getByText('Die Aufteilung ist nicht gleichmäßig. Nährwerte beziehen sich auf die angegebene Portion.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Liste kopieren' })).toBeInTheDocument();
    expect(screen.getByText('1 Artikel · 1 Bereiche')).toBeInTheDocument();
    expect(screen.getByText('Zucchini')).toBeInTheDocument();
  });

  it('renders the Bring export as a direct link without opening a popup', async () => {
    renderApp('/');

    const bringLink = await screen.findByRole('link', { name: 'Woche zu Bring' });

    expect(bringLink).toHaveAttribute('href', expect.stringContaining('https://enjoy.getbring.com/ZAzR'));
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

  it('keeps the weekly Bring link stable when shopping list contents change', async () => {
    let exportCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/plans/plan-1/bring-export-url')) {
        exportCalls += 1;
        return new Response(JSON.stringify({ url: `https://enjoy.getbring.com/ZAzR?token=${exportCalls}` }), {
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
      'https://enjoy.getbring.com/ZAzR?token=1'
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
      'https://enjoy.getbring.com/ZAzR?token=1'
    );
  });

  it('moves through days as a carousel', async () => {
    renderApp('/');

    expect(await screen.findByRole('button', { name: /Pasta mit Gemüse/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(await screen.findByRole('button', { name: /Beeren-Porridge/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pasta mit Gemüse/ })).not.toBeInTheDocument();
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

  it('copies the shopping list as Bring fallback', async () => {
    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Liste kopieren' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Zucchini 2 Stk');
    });
    expect(screen.getByRole('button', { name: 'Kopiert' })).toBeInTheDocument();
  });

  it('keeps the Bring export button mobile friendly', () => {
    expect(styles).toContain('.bring-export-button');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('@media (max-width: 760px)');
    expect(styles).toContain('.surface-actions,\n  .bring-export-button {\n    width: 100%;');
    expect(styles).toContain('.board-carousel');
    expect(styles).toContain('.day-tabs');
  });

  it('opens onboarding and saves the profile', async () => {
    renderApp('/onboarding');

    expect(await screen.findByText('Profil anlegen')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Haushaltsname'), { target: { value: 'Familie Weber' } });
    fireEvent.change(screen.getByLabelText('Mitglieder'), { target: { value: 'Anna\nBen' } });
    fireEvent.change(screen.getByLabelText('Standard-Portionen'), { target: { value: '4' } });

    fireEvent.click(screen.getByRole('button', { name: 'Profil speichern' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/profile'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
        })
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText('Profil gespeichert. Der nächste Wochenplan nutzt diese Angaben.').length).toBeGreaterThan(0);
    });
  });

  it('creates a family invite link from onboarding', async () => {
    renderApp('/onboarding');

    expect(await screen.findByText('Familienkonto')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('E-Mail-Adresse für Einladung'), {
      target: { value: 'person@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Einladungslink erstellen' }));

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
    expect(screen.getByText(/persönliche Account geht im Familienkonto auf/i)).toBeInTheDocument();
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
          return new Response(JSON.stringify({ error: 'Das hat gerade nicht geklappt. Bitte versuche es erneut.' }), {
            status: 500,
          });
        }
        return new Response('', { status: 404 });
      }) as unknown as typeof fetch
    );

    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Woche planen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Das hat gerade nicht geklappt. Bitte versuche es erneut.'
    );
  });

  it('sends a note when regenerating a meal', async () => {
    renderApp('/');

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Pasta mit Gemüse/ });
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

  it('logs out and returns to the login page', async () => {
    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
        })
      );
    });
    expect(await screen.findByRole('link', { name: 'Mit Google anmelden' })).toBeInTheDocument();
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
          return new Response(JSON.stringify({ url: 'https://enjoy.getbring.com/ZAzR?token=test-token' }), {
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

    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Logout gerade nicht möglich');
    expect(screen.getByText('Was essen wir diese Woche?')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mit Google anmelden' })).not.toBeInTheDocument();
  });

  it('renders legal pages with explicit review status', async () => {
    renderApp('/datenschutz');

    expect(await screen.findByRole('heading', { name: 'Datenschutz' })).toBeInTheDocument();
    expect(screen.getByText('Rechtliche Prüfung ausstehend')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Verantwortlicher' })).toBeInTheDocument();

    renderApp('/impressum');

    expect(await screen.findByRole('heading', { name: 'Impressum' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Anbieterkennzeichnung' })).toBeInTheDocument();
  });
});
