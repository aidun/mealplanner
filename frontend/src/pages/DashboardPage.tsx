import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { MealBoard } from '../components/MealBoard';
import { MealInspector } from '../components/MealInspector';
import { ShoppingListPanel } from '../components/ShoppingListPanel';
import { LoginPage } from './LoginPage';
import {
  createPlan,
  createFavorite,
  deleteFavorite,
  getFamily,
  getCurrentPlan,
  getFavorites,
  getLatestPromptDebug,
  getProfile,
  getShoppingList,
  logout,
  regenerateMeal,
} from '../api';
import type { Meal } from '../types';

function promptDebugEnabled() {
  return import.meta.env.VITE_PROMPT_DEBUG === 'true' || window.localStorage.getItem('mealplanner.promptDebug') === 'true';
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const promptDebug = promptDebugEnabled();
  const [selectedMealId, setSelectedMealId] = useState<string | undefined>();
  const [loggedOut, setLoggedOut] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const currentPlanQuery = useQuery({
    queryKey: ['current-plan'],
    queryFn: getCurrentPlan,
  });

  const shoppingListQuery = useQuery({
    queryKey: ['shopping-list', currentPlanQuery.data?.id],
    queryFn: () => getShoppingList(currentPlanQuery.data!.id),
    enabled: Boolean(currentPlanQuery.data?.id),
  });

  const familyQuery = useQuery({
    queryKey: ['family'],
    queryFn: getFamily,
  });

  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
  });

  const promptDebugQuery = useQuery({
    queryKey: ['prompt-debug'],
    queryFn: getLatestPromptDebug,
    enabled: promptDebug,
  });

  const createPlanMutation = useMutation({
    mutationFn: () => createPlan({}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['current-plan'] });
      await queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });

  const regenerateMealMutation = useMutation({
    mutationFn: ({ planId, mealId, note }: { planId: string; mealId: string; note: string }) =>
      regenerateMeal(planId, mealId, note),
    onSuccess: async (updatedPlan) => {
      if (updatedPlan) {
        queryClient.setQueryData(['current-plan'], updatedPlan);
      }
      await queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });

  const createFavoriteMutation = useMutation({
    mutationFn: createFavorite,
    onSuccess: async (favorite) => {
      if (favorite) {
        queryClient.setQueryData(['favorites'], (current: unknown) => {
          const list = Array.isArray(current) ? current : [];
          return [...list.filter((item: any) => item.id !== favorite.id), favorite];
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const deleteFavoriteMutation = useMutation({
    mutationFn: deleteFavorite,
    onSuccess: async (_result, favoriteId) => {
      queryClient.setQueryData(['favorites'], (current: unknown) => {
        const list = Array.isArray(current) ? current : [];
        return list.filter((item: any) => item.id !== favoriteId);
      });
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      queryClient.setQueryData(['session'], { authenticated: false });
      setLoggedOut(true);
    },
  });

  const allMeals = useMemo(() => currentPlanQuery.data?.days.flatMap((day) => day.meals) ?? [], [
    currentPlanQuery.data,
  ]);

  const selectedMeal = useMemo(
    () => allMeals.find((meal) => meal.id === selectedMealId) ?? allMeals[0],
    [allMeals, selectedMealId]
  );
  const selectedDay = useMemo(
    () => currentPlanQuery.data?.days.find((day) => day.meals.some((meal) => meal.id === selectedMeal?.id)),
    [currentPlanQuery.data?.days, selectedMeal?.id]
  );
  const favoriteByMealID = useMemo(() => {
    const map = new Map<string, string>();
    for (const favorite of favoritesQuery.data ?? []) {
      if (favorite.meal.id) map.set(favorite.meal.id, favorite.id);
    }
    return map;
  }, [favoritesQuery.data]);

  useEffect(() => {
    if (!selectedMealId && allMeals[0]) {
      setSelectedMealId(allMeals[0].id);
    }
  }, [allMeals, selectedMealId]);

  useEffect(() => {
    if (selectedMealId && !allMeals.some((meal) => meal.id === selectedMealId)) {
      setSelectedMealId(allMeals[0]?.id);
    }
  }, [allMeals, selectedMealId]);

  const handleRegenerate = (note: string) => {
    const plan = currentPlanQuery.data;
    if (!plan || !selectedMeal) return;

    regenerateMealMutation.mutate({
      planId: plan.id,
      mealId: selectedMeal.id,
      note,
    });
  };

  const handleToggleFavorite = (meal: Meal, favoriteId?: string) => {
    if (favoriteId) {
      deleteFavoriteMutation.mutate(favoriteId);
      return;
    }
    createFavoriteMutation.mutate(meal);
  };

  const profile = profileQuery.data;
  const profileMembers = profile?.members ?? [];
  const profilePresets = profile?.presets ?? [];
  const planMessage = createPlanMutation.isPending
    ? 'Wir stellen eure Woche zusammen.'
    : createPlanMutation.isError
      ? errorMessage(createPlanMutation.error)
      : createPlanMutation.isSuccess
        ? 'Der neue Wochenplan ist fertig.'
        : currentPlanQuery.isError
          ? 'Der aktuelle Plan konnte nicht geladen werden.'
          : '';
  const regenerateMessage = regenerateMealMutation.isError
    ? errorMessage(regenerateMealMutation.error)
    : regenerateMealMutation.isSuccess
      ? 'Das Gericht wurde ausgetauscht.'
      : '';
  const logoutMessage = logoutMutation.isError ? 'Logout gerade nicht möglich. Bitte versuche es erneut.' : '';

  return loggedOut ? (
    <LoginPage />
  ) : (
    <div className="app-shell">
      <Header
        weekStart={currentPlanQuery.data?.weekStart}
        onCreatePlan={() => createPlanMutation.mutate()}
        creatingPlan={createPlanMutation.isPending}
        onLogout={() => logoutMutation.mutate()}
        loggingOut={logoutMutation.isPending}
      />

      <main className="app-main">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <span className="eyebrow">Familien-Essensplan</span>
            <h1 id="home-title">Was essen wir diese Woche?</h1>
            <p>
              {profile
                ? `${profile.householdName}: Mahlzeiten, Mengen und Einkauf auf einen Blick.`
                : 'Legt kurz eure Familie an. Danach steht euer erster Wochenplan bereit.'}
            </p>
            <div className="profile-chip-row" aria-label="Familienzusammenfassung">
              {profileMembers.length > 0 ? (
                profileMembers.map((member) => (
                  <span key={member.id} className="profile-chip">
                    {member.name}
                  </span>
                ))
              ) : (
                <span className="profile-chip profile-chip-muted">Keine Personen hinterlegt</span>
              )}
              {profilePresets.slice(0, 4).map((preset) => (
                <span key={preset} className="profile-chip profile-chip-accent">
                  {preset}
                </span>
              ))}
              {familyQuery.data ? (
                <span className="profile-chip profile-chip-accent">{familyQuery.data.memberCount} im Familienkonto</span>
              ) : null}
            </div>
          </div>

          <div className="home-hero-actions">
            <button
              type="button"
              className="button button-primary home-primary-action"
              onClick={() => createPlanMutation.mutate()}
              disabled={createPlanMutation.isPending}
            >
              {createPlanMutation.isPending ? 'Woche entsteht' : 'Woche planen'}
            </button>
            <div className="profile-stat">
              <span>{profileMembers.length}</span>
              <strong>Personen</strong>
            </div>
            <div className="profile-stat">
              <span>{profilePresets.length}</span>
              <strong>Presets</strong>
            </div>
            <Link to="/onboarding" className="button button-primary profile-cta">
              Profil bearbeiten
            </Link>
          </div>
        </section>

        {planMessage || regenerateMessage || logoutMessage ? (
          <div
            className={`status-strip${createPlanMutation.isError || regenerateMealMutation.isError || currentPlanQuery.isError || logoutMutation.isError ? ' status-strip-error' : ' status-strip-success'}`}
            role={createPlanMutation.isError || regenerateMealMutation.isError || currentPlanQuery.isError || logoutMutation.isError ? 'alert' : 'status'}
            aria-live="polite"
          >
            <span>{planMessage || regenerateMessage || logoutMessage}</span>
          </div>
        ) : null}

        <div className="workspace">
          <div className="workspace-main">
            <MealBoard
              planId={currentPlanQuery.data?.id}
              days={currentPlanQuery.data?.days}
              selectedMealId={selectedMealId}
              onSelectMeal={(meal) => setSelectedMealId(meal.id)}
            />
            <MealInspector
              planId={currentPlanQuery.data?.id}
              dayDate={selectedDay?.date}
              meal={selectedMeal}
              favoriteId={selectedMeal ? favoriteByMealID.get(selectedMeal.id) : undefined}
              onToggleFavorite={handleToggleFavorite}
              onRegenerate={handleRegenerate}
              isRegenerating={regenerateMealMutation.isPending}
              isFavoriteBusy={createFavoriteMutation.isPending || deleteFavoriteMutation.isPending}
            />
          </div>

          <div className="workspace-side">
            <ShoppingListPanel
              planId={currentPlanQuery.data?.id}
              shoppingList={shoppingListQuery.data ?? null}
              loading={shoppingListQuery.isLoading}
            />
          </div>
        </div>

        {promptDebug ? (
          <PromptDebugOverlay
            loading={promptDebugQuery.isLoading}
            prompt={promptDebugQuery.data?.prompt}
            operation={promptDebugQuery.data?.operation}
            onRefresh={() => promptDebugQuery.refetch()}
          />
        ) : null}
      </main>
    </div>
  );
}

function PromptDebugOverlay({
  loading,
  prompt,
  operation,
  onRefresh,
}: {
  loading: boolean;
  prompt?: string;
  operation?: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="prompt-debug">
      <button type="button" className="button button-secondary" onClick={() => setOpen((value) => !value)}>
        Prompt prüfen
      </button>
      {open ? (
        <section className="prompt-debug-panel" aria-label="Prompt Debug Overlay">
          <div className="surface-header">
            <div>
              <span className="eyebrow">Testmodus</span>
              <h2>{operation ?? 'Prompt'}</h2>
            </div>
            <button type="button" className="button button-secondary compact-action" onClick={onRefresh}>
              Aktualisieren
            </button>
          </div>
          <pre>{loading ? 'Prompt wird geladen.' : prompt ?? 'Noch kein Prompt gespeichert.'}</pre>
        </section>
      ) : null}
    </div>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as { error?: string };
      return parsed.error ?? error.message;
    } catch {
      return error.message;
    }
  }
  return 'Aktion konnte nicht ausgeführt werden.';
}
