import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { MealBoard } from '../components/MealBoard';
import { MealInspector } from '../components/MealInspector';
import { PlanBackdrop } from '../components/PlanBackdrop';
import { ShoppingListPanel } from '../components/ShoppingListPanel';
import { readableApiError } from '../lib/api-error';
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
  const [favoriteSlotFilter, setFavoriteSlotFilter] = useState<'all' | string>('all');
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
  const favorites = favoritesQuery.data ?? [];
  const filteredFavorites = useMemo(
    () => favorites.filter((favorite) => favoriteSlotFilter === 'all' || favorite.meal.slot === favoriteSlotFilter),
    [favoriteSlotFilter, favorites]
  );
  const favoriteSlots = useMemo(() => summarizeFavoriteSlots(favorites), [favorites]);
  const favoriteTags = useMemo(() => summarizeFavoriteTags(favorites), [favorites]);
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
    ? readableApiError(createPlanMutation.error)
      : createPlanMutation.isSuccess
        ? 'Der neue Wochenplan ist fertig.'
        : currentPlanQuery.isError
          ? 'Der aktuelle Plan konnte nicht geladen werden.'
          : '';
  const regenerateMessage = regenerateMealMutation.isError
    ? readableApiError(regenerateMealMutation.error)
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
            <p>Der Wochenplan steht im Mittelpunkt: Gerichte wählen, feinjustieren und ohne Umwege in den Alltag bringen.</p>
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

        {favorites.length > 0 ? (
          <section className="favorites-rail" aria-labelledby="favorites-title">
            <div className="favorites-rail-copy">
              <span className="eyebrow">Favoriten</span>
              <h2 id="favorites-title">Wieder gern kochen</h2>
              <p>Rezepte, die zu euch passen und bei neuen Wochen bewusst wieder auftauchen dürfen.</p>
            </div>
            <div className="favorites-rail-summary" aria-label="Favoriten wirken auf neue Wochen">
              <div className="favorites-rail-stat">
                <strong>{favorites.length}</strong>
                <span>liegen fuer die naechste Woche bereit</span>
              </div>
              <div className="favorites-rail-stat">
                <strong>{favoriteSlots.join(', ') || 'alle Mahlzeiten'}</strong>
                <span>werden beim Planen zuerst geprueft</span>
              </div>
              <div className="favorites-rail-stat">
                <strong>{favoriteTags[0] ?? 'euer Stil'}</strong>
                <span>taucht bevorzugt als Richtung wieder auf</span>
              </div>
            </div>
            <div className="favorites-filter-row" aria-label="Favoriten filtern">
              <button
                type="button"
                className={`tag-button${favoriteSlotFilter === 'all' ? ' tag-button-active' : ''}`}
                onClick={() => setFavoriteSlotFilter('all')}
              >
                Alle
              </button>
              {Array.from(new Set(favorites.map((favorite) => favorite.meal.slot).filter(Boolean))).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`tag-button${favoriteSlotFilter === slot ? ' tag-button-active' : ''}`}
                  onClick={() => setFavoriteSlotFilter(slot)}
                >
                  {slotLabel(slot)}
                </button>
              ))}
            </div>
            <div className="favorites-rail-list">
              {filteredFavorites.map((favorite) => {
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
            <div className="favorites-collection">
              {filteredFavorites.slice(0, 6).map((favorite) => (
                <article key={`collection-${favorite.id}`} className="favorite-collection-card">
                  <div>
                    <span className="eyebrow">{slotLabel(favorite.meal.slot || 'Mahlzeit')}</span>
                    <h3>{favorite.meal.title}</h3>
                    <p>{favorite.meal.description || 'Bleibt in eurer Sammlung und darf wieder auftauchen.'}</p>
                  </div>
                  <div className="favorite-collection-meta">
                    <span>{favorite.meal.tags?.[0] ?? 'familientauglich'}</span>
                    <button type="button" className="button button-secondary compact-action" onClick={() => selectFavorite(favorite)}>
                      Ansehen
                    </button>
                  </div>
                </article>
              ))}
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
  const requestMetrics = snapshot?.openai?.requests ?? [];
  const totalRequests = requestMetrics.reduce((sum, metric) => sum + metric.count, 0);
  const successRequests = requestMetrics
    .filter((metric) => metric.status === 'success')
    .reduce((sum, metric) => sum + metric.count, 0);
  const averageDuration = totalRequests > 0
    ? requestMetrics.reduce((sum, metric) => sum + metric.durationSum, 0) / totalRequests
    : 0;
  const operations = mergePromptOperations(snapshot);

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
              <div className="prompt-debug-metric">
                <strong>{successRequests}/{totalRequests || 0}</strong>
                <span>Requests erfolgreich</span>
              </div>
              <div className="prompt-debug-metric">
                <strong>{averageDuration > 0 ? `${averageDuration.toFixed(2)}s` : 'n/a'}</strong>
                <span>mittlere Dauer</span>
              </div>
            </div>
          ) : null}
          {operations.length > 0 ? (
            <div className="prompt-debug-history">
              <h3>Diagnose</h3>
              <div className="prompt-debug-ops">
                {operations.map((operation) => (
                  <article key={operation.operation} className="prompt-debug-op">
                    <strong>{operation.operation}</strong>
                    <span>{operation.model || 'mealplanner'}</span>
                    <span>{operation.tokens > 0 ? `${operation.tokens} Tokens` : 'ohne Tokenwert'}</span>
                    <span>{operation.requests > 0 ? `${operation.requests} Requests` : 'ohne Requestwert'}</span>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
          {latest?.meta && Object.keys(latest.meta).length > 0 ? (
            <div className="prompt-debug-history">
              <h3>Kontext</h3>
              <div className="prompt-debug-meta">
                {Object.entries(latest.meta).map(([key, value]) => (
                  <article key={key} className="prompt-debug-meta-item">
                    <span>{formatPromptMetaKey(key)}</span>
                    <strong>{value || '—'}</strong>
                  </article>
                ))}
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
                    {entry.createdAt ? ` · ${formatPromptTimestamp(entry.createdAt)}` : ''}
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

function summarizeFavoriteSlots(favorites: FavoriteRecipe[]) {
  return Array.from(
    new Set(
      favorites
        .map((favorite) => favorite.meal.slot)
        .filter(Boolean)
        .map((slot) => slotLabel(slot))
    )
  ).slice(0, 3);
}

function summarizeFavoriteTags(favorites: FavoriteRecipe[]) {
  const counts = new Map<string, number>();
  for (const favorite of favorites) {
    for (const tag of favorite.meal.tags ?? []) {
      const value = tag.trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([tag]) => tag)
    .slice(0, 3);
}

function slotLabel(slot?: string) {
  switch (slot) {
    case 'breakfast':
      return 'Fruehstueck';
    case 'lunch':
      return 'Mittag';
    case 'dinner':
      return 'Abendessen';
    case 'snack':
      return 'Snack';
    default:
      return slot || '';
  }
}

function formatPromptTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function mergePromptOperations(snapshot?: PromptDebugSnapshot) {
  const operations = new Map<string, { operation: string; model?: string; tokens: number; requests: number }>();
  for (const token of snapshot?.openai?.tokens ?? []) {
    if (token.type !== 'total') continue;
    const key = `${token.operation}:${token.model}`;
    const current = operations.get(key) ?? { operation: token.operation, model: token.model, tokens: 0, requests: 0 };
    current.tokens += token.count;
    operations.set(key, current);
  }
  for (const request of snapshot?.openai?.requests ?? []) {
    const key = `${request.operation}:${request.model}`;
    const current = operations.get(key) ?? { operation: request.operation, model: request.model, tokens: 0, requests: 0 };
    current.requests += request.count;
    operations.set(key, current);
  }
  return Array.from(operations.values()).sort((left, right) => right.tokens - left.tokens || right.requests - left.requests);
}

function formatPromptMetaKey(value: string) {
  switch (value) {
    case 'requestedWeekStart':
      return 'Angefragter Start';
    case 'promptVersion':
      return 'Prompt-Version';
    case 'members':
      return 'Mitglieder';
    case 'favorites':
      return 'Favoriten';
    case 'mealID':
      return 'Mahlzeit';
    case 'noteProvided':
      return 'Anmerkung';
    case 'existingMeals':
      return 'Mahlzeiten im Plan';
    case 'targetMembers':
      return 'Profilmitglieder Ziel';
    case 'incomingMembers':
      return 'Profilmitglieder Quelle';
    default:
      return value;
  }
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
