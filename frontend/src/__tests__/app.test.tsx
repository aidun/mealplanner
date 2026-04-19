import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
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
          servings: [{ memberId: 'anna', name: 'Anna', portion: '100% Portion', factor: 1 }],
          ingredients: [{ name: 'Pasta', amount: 400, unit: 'g' }],
          instructions: ['Wasser kochen', 'Sauce mischen'],
          nutrition: { calories: 560, proteinG: 24, carbsG: 72, fatG: 14 },
          estimatedNutrition: true,
          tags: ['schnell', 'vegetarisch'],
        },
      ],
    },
  ],
};

const shoppingList = [{ name: 'Zucchini', amount: 2, unit: 'Stk', category: 'Gemüse' }];

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
  vi.spyOn(window, 'open').mockImplementation(() => null);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith('/api/profile') && (!init || !init.method || init.method === 'GET')) {
      return new Response(JSON.stringify(profile), { status: 200 });
    }

    if (url.endsWith('/api/plans/current')) {
      return new Response(JSON.stringify(plan), { status: 200 });
    }

    if (url.endsWith('/api/plans/plan-1/shopping-list')) {
      return new Response(JSON.stringify(shoppingList), { status: 200 });
    }

    if (url.includes('/regenerate')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (url.endsWith('/api/plans') && init?.method === 'POST') {
      return new Response(JSON.stringify(plan), { status: 200 });
    }

    if (url.endsWith('/api/profile') && init?.method === 'PUT') {
      return new Response(JSON.stringify(profile), { status: 200 });
    }

    return new Response('', { status: 404 });
  }) as unknown as typeof fetch);
});

describe('Mealplanner app', () => {
  it('renders the weekly board and shopping list', async () => {
    renderApp('/');

    expect(await screen.findByText('Wochenboard')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Pasta mit Gemüse/ })).toBeInTheDocument();
    expect(await screen.findByText('Einkaufsliste')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zu Bring' })).toBeInTheDocument();
    expect(screen.getByText('Zucchini')).toBeInTheDocument();
  });

  it('opens the Bring export page for the current plan', async () => {
    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Zu Bring' }));

    expect(window.open).toHaveBeenCalledWith(
      '/api/plans/plan-1/bring-export',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('keeps the Bring export button mobile friendly', () => {
    expect(styles).toContain('.bring-export-button');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('@media (max-width: 760px)');
    expect(styles).toContain('.surface-action,\n  .bring-export-button {\n    width: 100%;');
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
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  it('sends a note when regenerating a meal', async () => {
    renderApp('/');

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Pasta mit Gemüse/ });
    const noteField = screen.getByLabelText('Notiz für Neu-Generierung');
    await user.click(noteField);
    await user.type(noteField, 'Weniger Salz, mehr Gemüse.');
    fireEvent.click(screen.getByRole('button', { name: 'Mahlzeit neu generieren' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/plans/plan-1/meals/meal-1/regenerate'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ note: 'Weniger Salz, mehr Gemüse.' }),
        })
      );
    });
  });
});
