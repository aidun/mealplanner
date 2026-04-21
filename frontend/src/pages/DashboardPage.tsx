import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { MealBoard } from '../components/MealBoard';
import { MealInspector } from '../components/MealInspector';
import { PlanBackdrop } from '../components/PlanBackdrop';
import { ShoppingListPanel } from '../components/ShoppingListPanel';
import { LoginPage } from './LoginPage';
import {
  createPlan,
  createFavorite,
  deleteFavorite,
  getCurrentPlan,
  getFavorites,
  getLatestPromptDebug,
  getShoppingList,
  logout,
  regenerateMeal,
} from '../api';
import type { FavoriteRecipe, Meal, PromptDebugSnapshot } from '../types';

function promptDebugEnabled() {
  return import.meta.env.VITE_PROMPT_DEBUG === 'true' || window.localStorage.getItem('mealplanner.promptDebug') === 'true';
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const promptDebug = promptDebugEnabled();
  const [selectedMealId, setSelectedMealId] = useState<string | undefined>();
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | undefined>();
  const [activeWorkspacePane, setActiveWorkspacePane] = useState<'plan' | 'detail' | 'shopping'>('plan');
  const [loggedOut, setLoggedOut] = useState(false);

  const currentPlanQuery = useQuery({
    queryKey: ['current-plan'],
    queryFn: getCurrentPlan,
  });

  const shoppingListQuery = useQuery({
    queryKey: ['shopping-list', currentPlanQuery.data?.id],
    queryFn: () => getShoppingList(currentPlanQuery.data!.id),
    enabled: Boolean(currentPlanQuery.data?.id),
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
      setSelectedFavoriteId(undefined);
      setActiveWorkspacePane('plan');
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
      setSelectedFavoriteId(undefined);
      setActiveWorkspacePane('detail');
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
  const favoriteByMealID = useMemo(() => {
    const map = new Map<string, string>();
    for (const favorite of favoritesQuery.data ?? []) {
      if (favorite.meal.id) map.set(favorite.meal.id, favorite.id);
    }
    return map;
  }, [favoritesQuery.data]);
  const favoriteMealIDs = useMemo(() => new Set((favoritesQuery.data ?? []).map((favorite) => favorite.meal.id).filter(Boolean)), [
    favoritesQuery.data,
  ]);
  const selectedFavorite = useMemo(
    () => (favoritesQuery.data ?? []).find((favorite) => favorite.id === selectedFavoriteId),
    [favoritesQuery.data, selectedFavoriteId]
  );
  const inspectedMeal = selectedFavorite?.meal ?? selectedMeal;
  const selectedDay = useMemo(
    () => currentPlanQuery.data?.days.find((day) => day.meals.some((meal) => meal.id === inspectedMeal?.id)),
    [currentPlanQuery.data?.days, inspectedMeal?.id]
  );
  const inspectedMealInPlan = useMemo(
    () => Boolean(inspectedMeal && allMeals.some((meal) => meal.id === inspectedMeal.id)),
    [allMeals, inspectedMeal]
  );

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

  useEffect(() => {
    if (selectedFavoriteId && !(favoritesQuery.data ?? []).some((favorite) => favorite.id === selectedFavoriteId)) {
      setSelectedFavoriteId(undefined);
    }
  }, [favoritesQuery.data, selectedFavoriteId]);

  const handleRegenerate = (note: string) => {
    const plan = currentPlanQuery.data;
    if (!plan || !inspectedMeal || !inspectedMealInPlan) return;

    regenerateMealMutation.mutate({
      planId: plan.id,
      mealId: inspectedMeal.id,
      note,
    });
  };

  const handleToggleFavorite = (meal: Meal, favoriteId?: string) => {
    if (favoriteId) {
      if (selectedFavoriteId === favoriteId) {
        setSelectedFavoriteId(undefined);
      }
      deleteFavoriteMutation.mutate(favoriteId);
      return;
    }
    createFavoriteMutation.mutate(meal);
  };

  const selectMeal = (meal: Meal) => {
    setSelectedFavoriteId(undefined);
    setSelectedMealId(meal.id);
    setActiveWorkspacePane('detail');
  };

  const selectFavorite = (favorite: FavoriteRecipe) => {
    setSelectedFavoriteId(favorite.id);
    setActiveWorkspacePane('detail');
  };

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
        <section className="plan-stage" aria-labelledby="home-title">
          <PlanBackdrop />
          <div className="plan-stage-copy plan-stage-copy-compact">
            <span className="eyebrow">Diese Woche</span>
            <h1 id="home-title">Planen, auswählen, kochen.</h1>
            <p>Von der Woche aus gedacht: Gerichte waehlen, anpassen und direkt in den Alltag holen.</p>
          </div>
          <div className="plan-stage-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => createPlanMutation.mutate()}
              disabled={createPlanMutation.isPending}
            >
              {createPlanMutation.isPending ? 'Woche entsteht' : 'Woche planen'}
            </button>
            <Link to="/onboarding" className="button button-secondary">
              Profil
            </Link>
          </div>
          <div className="plan-stage-meta" aria-label="Planstatus">
            <div className="stage-stat">
              <strong>{currentPlanQuery.data?.days.length ?? 0}</strong>
              <span>Tage im Plan</span>
            </div>
            <div className="stage-stat">
              <strong>{allMeals.length}</strong>
              <span>Mahlzeiten</span>
            </div>
            <div className="stage-stat">
              <strong>{shoppingListQuery.data ? countShoppingItems(shoppingListQuery.data) : 0}</strong>
              <span>Einkäufe</span>
            </div>
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

        {(favoritesQuery.data ?? []).length > 0 ? (
          <section className="favorites-rail" aria-labelledby="favorites-title">
            <div className="favorites-rail-copy">
              <span className="eyebrow">Favoriten</span>
              <h2 id="favorites-title">Wieder gern kochen</h2>
              <p>Gerichte, die ihr behalten wollt und die bei neuen Wochen wieder auftauchen duerfen.</p>
            </div>
            <div className="favorites-rail-list">
              {(favoritesQuery.data ?? []).map((favorite) => {
                const active = selectedFavoriteId === favorite.id;
                return (
                  <button
                    key={favorite.id}
                    type="button"
                    className={`favorite-rail-item${active ? ' favorite-rail-item-active' : ''}`}
                    onClick={() => selectFavorite(favorite)}
                  >
                    <strong>{favorite.meal.title}</strong>
                    <span>{favorite.meal.slot || 'Mahlzeit'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="workspace-pane-switch" aria-label="Bereiche wechseln">
          <button
            type="button"
            className={`workspace-pane-button${activeWorkspacePane === 'plan' ? ' workspace-pane-button-active' : ''}`}
            onClick={() => setActiveWorkspacePane('plan')}
          >
            Plan
          </button>
          <button
            type="button"
            className={`workspace-pane-button${activeWorkspacePane === 'detail' ? ' workspace-pane-button-active' : ''}`}
            onClick={() => setActiveWorkspacePane('detail')}
          >
            Details
          </button>
          <button
            type="button"
            className={`workspace-pane-button${activeWorkspacePane === 'shopping' ? ' workspace-pane-button-active' : ''}`}
            onClick={() => setActiveWorkspacePane('shopping')}
          >
            Einkauf
          </button>
        </div>

        <div className="workspace">
          <div className="workspace-main">
            <div className={activeWorkspacePane === 'detail' ? 'workspace-pane-hidden-mobile' : ''}>
              <MealBoard
                planId={currentPlanQuery.data?.id}
                days={currentPlanQuery.data?.days}
                selectedMealId={selectedMealId}
                favoriteMealIDs={favoriteMealIDs}
                onSelectMeal={selectMeal}
              />
            </div>
            <div className={activeWorkspacePane === 'plan' ? 'workspace-pane-hidden-mobile' : ''}>
              <MealInspector
                planId={currentPlanQuery.data?.id}
                dayDate={selectedDay?.date}
                meal={inspectedMeal}
                favoriteId={selectedFavorite ? selectedFavorite.id : inspectedMeal ? favoriteByMealID.get(inspectedMeal.id) : undefined}
                contextNote={selectedFavorite ? 'Favorit aus eurer Sammlung' : undefined}
                canActOnMeal={inspectedMealInPlan}
                onToggleFavorite={handleToggleFavorite}
                onRegenerate={handleRegenerate}
                isRegenerating={regenerateMealMutation.isPending}
                isFavoriteBusy={createFavoriteMutation.isPending || deleteFavoriteMutation.isPending}
              />
            </div>
          </div>

          <div className={`workspace-side${activeWorkspacePane !== 'shopping' ? ' workspace-pane-hidden-mobile' : ''}`}>
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
            snapshot={promptDebugQuery.data ?? undefined}
            onRefresh={() => promptDebugQuery.refetch()}
          />
        ) : null}
      </main>
    </div>
  );
}

function PromptDebugOverlay({
  loading,
  snapshot,
  onRefresh,
}: {
  loading: boolean;
  snapshot?: PromptDebugSnapshot;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const latest = snapshot?.latest;
  const recent = snapshot?.recent ?? [];
  const totalTokens = (snapshot?.openai?.tokens ?? []).filter((metric) => metric.type === 'total');

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
              <h2>{latest?.operation ?? 'Prompt'}</h2>
            </div>
            <button type="button" className="button button-secondary compact-action" onClick={onRefresh}>
              Aktualisieren
            </button>
          </div>
          {latest ? (
            <div className="prompt-debug-metrics">
              <div className="prompt-debug-metric">
                <strong>{latest.model || 'mealplanner'}</strong>
                <span>Modell</span>
              </div>
              <div className="prompt-debug-metric">
                <strong>{recent.length}</strong>
                <span>letzte Prompts</span>
              </div>
              <div className="prompt-debug-metric">
                <strong>{totalTokens.reduce((sum, metric) => sum + metric.count, 0)}</strong>
                <span>OpenAI Tokens</span>
              </div>
            </div>
          ) : null}
          <pre>{loading ? 'Prompt wird geladen.' : latest?.prompt ?? 'Noch kein Prompt gespeichert.'}</pre>
          {recent.length > 1 ? (
            <div className="prompt-debug-history">
              <h3>Letzte Vorgänge</h3>
              <ul className="list">
                {recent.slice(0, 5).map((entry, index) => (
                  <li key={`${entry.operation}-${entry.createdAt ?? index}`}>
                    <strong>{entry.operation}</strong>
                    {entry.model ? ` · ${entry.model}` : ''}
                    {entry.createdAt ? ` · ${entry.createdAt}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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

function countShoppingItems(shoppingList: unknown) {
  if (!shoppingList) return 0;
  if (Array.isArray(shoppingList)) return shoppingList.length;
  if (typeof shoppingList === 'object' && shoppingList !== null) {
    const value = shoppingList as { sections?: { items?: unknown[] }[]; items?: unknown[] };
    if (Array.isArray(value.sections) && value.sections.length > 0) {
      return value.sections.reduce((sum, section) => sum + (Array.isArray(section.items) ? section.items.length : 0), 0);
    }
    if (Array.isArray(value.items)) return value.items.length;
  }
  return 0;
}
