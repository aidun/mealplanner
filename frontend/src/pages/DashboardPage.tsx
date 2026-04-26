import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams, type SetURLSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { RefreshIcon, SparkIcon } from '../components/icons';
import { MealBoard } from '../components/MealBoard';
import { MealInspector } from '../components/MealInspector';
import { PlanBackdrop } from '../components/PlanBackdrop';
import { ShoppingListPanel } from '../components/ShoppingListPanel';
import { readableApiError } from '../lib/api-error';
import { formatDate, formatWeekRange } from '../lib/format';
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
import { useSession } from '../session';
import type { Meal, PromptDebugSnapshot } from '../types';

function promptDebugEnabled() {
  if (import.meta.env.VITE_PROMPT_DEBUG !== 'true') {
    return false;
  }
  return window.localStorage.getItem('mealplanner.promptDebug') !== 'false';
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const promptDebug = promptDebugEnabled();
  const [loggedOut, setLoggedOut] = useState(false);
  const [mobileMenuHidden, setMobileMenuHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const scrollTickingRef = useRef(false);
  const mobileMenuHiddenRef = useRef(false);
  const activeWorkspacePane = parsePane(searchParams.get('pane'));
  const selectedMealId = searchParams.get('meal') ?? undefined;
  const selectedDayParam = searchParams.get('day') ?? undefined;

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
      updateSearchParams(setSearchParams, { pane: 'plan' });
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
      updateSearchParams(setSearchParams, { pane: 'detail' });
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
  const allDays = currentPlanQuery.data?.days ?? [];
  const activeDayDate = useMemo(() => {
    if (selectedDayParam && allDays.some((day) => day.date === selectedDayParam)) {
      return selectedDayParam;
    }
    const mealDay = selectedMealId
      ? allDays.find((day) => day.meals.some((meal) => meal.id === selectedMealId))?.date
      : undefined;
    return mealDay ?? allDays[0]?.date;
  }, [allDays, selectedDayParam, selectedMealId]);

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
  const inspectedMeal = selectedMeal;
  const selectedDay = useMemo(
    () =>
      currentPlanQuery.data?.days.find((day) => day.date === activeDayDate) ??
      currentPlanQuery.data?.days.find((day) => day.meals.some((meal) => meal.id === inspectedMeal?.id)),
    [activeDayDate, currentPlanQuery.data?.days, inspectedMeal?.id]
  );
  const inspectedMealInPlan = useMemo(
    () => Boolean(inspectedMeal && allMeals.some((meal) => meal.id === inspectedMeal.id)),
    [allMeals, inspectedMeal]
  );

  useEffect(() => {
    if (!selectedMealId && allMeals[0]) {
      const dayDate =
        currentPlanQuery.data?.days.find((day) => day.meals.some((meal) => meal.id === allMeals[0]?.id))?.date ??
        currentPlanQuery.data?.days[0]?.date;
      updateSearchParams(setSearchParams, { meal: allMeals[0].id, day: dayDate });
    }
  }, [allMeals, currentPlanQuery.data?.days, selectedMealId, setSearchParams]);

  useEffect(() => {
    if (selectedMealId && !allMeals.some((meal) => meal.id === selectedMealId)) {
      const fallbackMeal = allMeals[0];
      const dayDate =
        currentPlanQuery.data?.days.find((day) => day.meals.some((meal) => meal.id === fallbackMeal?.id))?.date ??
        currentPlanQuery.data?.days[0]?.date;
      updateSearchParams(setSearchParams, { meal: fallbackMeal?.id, day: dayDate });
    }
  }, [allMeals, currentPlanQuery.data?.days, selectedMealId, setSearchParams]);

  useEffect(() => {
    lastScrollYRef.current = Math.max(window.scrollY, 0);

    const updateMenuVisibility = (nextHidden: boolean) => {
      if (mobileMenuHiddenRef.current === nextHidden) {
        return;
      }
      mobileMenuHiddenRef.current = nextHidden;
      setMobileMenuHidden(nextHidden);
    };

    const flushScroll = () => {
      scrollTickingRef.current = false;
      const isMobile =
        typeof window.matchMedia === 'function'
          ? window.matchMedia('(max-width: 760px)').matches
          : window.innerWidth <= 760;
      const nextY = Math.max(window.scrollY, 0);

      if (!isMobile) {
        updateMenuVisibility(false);
        lastScrollYRef.current = nextY;
        return;
      }

      if (nextY <= 48) {
        updateMenuVisibility(false);
        lastScrollYRef.current = nextY;
        return;
      }

      const delta = nextY - lastScrollYRef.current;
      if (delta > 12 && nextY > 140) {
        updateMenuVisibility(true);
      } else if (delta < -18) {
        updateMenuVisibility(false);
      }

      lastScrollYRef.current = nextY;
    };

    const onScroll = () => {
      if (scrollTickingRef.current) {
        return;
      }
      scrollTickingRef.current = true;
      window.requestAnimationFrame(flushScroll);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    flushScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

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
      deleteFavoriteMutation.mutate(favoriteId);
      return;
    }
    createFavoriteMutation.mutate(meal);
  };

  const selectMealForDay = (meal: Meal, dayDate?: string) => {
    updateSearchParams(setSearchParams, { meal: meal.id, day: dayDate, pane: 'detail' });
  };

  const selectDay = (dayDate: string, defaultMealId?: string) => {
    updateSearchParams(setSearchParams, { day: dayDate, meal: defaultMealId, pane: activeWorkspacePane });
  };

  const planMessage = createPlanMutation.isPending
    ? 'Wir stellen eure Woche zusammen.'
    : createPlanMutation.isError
    ? readableApiError(createPlanMutation.error, 'Der Wochenplan konnte gerade nicht erstellt werden. Bitte versuche es gleich noch einmal.')
      : createPlanMutation.isSuccess
        ? 'Der neue Wochenplan ist fertig.'
        : currentPlanQuery.isError
          ? 'Der aktuelle Plan konnte nicht geladen werden.'
          : '';
  const regenerateMessage = regenerateMealMutation.isError
    ? readableApiError(regenerateMealMutation.error, 'Das Gericht konnte gerade nicht ausgetauscht werden. Bitte versuche es noch einmal.')
    : regenerateMealMutation.isSuccess
      ? 'Das Gericht wurde ausgetauscht.'
      : '';
  const logoutMessage = logoutMutation.isError ? 'Logout gerade nicht möglich. Bitte versuche es erneut.' : '';
  const shoppingItemCount = shoppingListQuery.data ? countShoppingItems(shoppingListQuery.data) : 0;
  const workspaceViews = [
    {
      id: 'plan' as const,
      title: 'Woche',
      description: selectedDay?.label
        ? `${selectedDay.label}: ${selectedDay.meals[0]?.title ?? 'noch offen'}`
        : 'Tage und Gerichte im Blick',
      meta: `${currentPlanQuery.data?.days.length ?? 0}`,
    },
    {
      id: 'detail' as const,
      title: 'Rezept',
      description: inspectedMeal?.title ?? 'Gericht auswählen',
      meta: inspectedMealInPlan ? 'Aktiv' : 'Offen',
    },
    {
      id: 'shopping' as const,
      title: 'Einkauf',
      description: shoppingItemCount > 0 ? `${shoppingItemCount} Dinge für die Woche` : 'Liste baut sich aus dem Plan auf',
      meta: `${shoppingItemCount}`,
    },
  ];
  const plannedMealCount = allMeals.length;
  const openDayCount = allDays.filter((day) => day.meals.length === 0).length;
  const weekRangeLabel = formatWeekRange(currentPlanQuery.data?.weekStart);
  const stageNarrative = useMemo(() => {
    if (!currentPlanQuery.data?.days.length) {
      return 'Noch kein Plan vorhanden. Stelle eine Woche zusammen und öffne danach Tage, Rezepte und Einkauf direkt im Fluss.';
    }
    const parts = [
      weekRangeLabel,
      `${plannedMealCount} Gericht${plannedMealCount === 1 ? '' : 'e'}`,
      shoppingItemCount > 0 ? `${shoppingItemCount} Position${shoppingItemCount === 1 ? '' : 'en'} im Einkauf` : 'Einkauf entsteht aus dem Plan',
    ];
    if (openDayCount > 0) {
      parts.push(`${openDayCount} Tag${openDayCount === 1 ? '' : 'e'} noch offen`);
    }
    return parts.join(' · ');
  }, [currentPlanQuery.data?.days.length, openDayCount, plannedMealCount, shoppingItemCount, weekRangeLabel]);
  const quickFacts = [
    {
      label: 'Woche',
      value: weekRangeLabel,
    },
    {
      label: 'Gerichte',
      value: plannedMealCount > 0 ? `${plannedMealCount} geplant` : 'Noch offen',
    },
    {
      label: 'Im Fokus',
      value: inspectedMeal?.title ?? selectedDay?.label ?? 'Tag auswählen',
    },
  ];
  const showPlanPane = activeWorkspacePane === 'plan';
  const showDetailPane = activeWorkspacePane === 'detail';
  const showShoppingPane = activeWorkspacePane === 'shopping';

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
        isAdmin={Boolean(session?.isAdmin)}
      />

      <main className="app-main">
        <section className="plan-stage" aria-labelledby="home-title">
          <PlanBackdrop />
          <div className="plan-stage-head">
            <div className="plan-stage-copy">
              <span className="eyebrow">Planner</span>
              <h1 id="home-title">Diese Woche am Tisch</h1>
              <p>{stageNarrative}</p>
            </div>
            <div className="plan-stage-actions">
              <Link to="/onboarding" className="button button-secondary">
                Küchenprofil schärfen
              </Link>
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  startTransition(() => {
                    updateSearchParams(setSearchParams, { pane: 'shopping' });
                  })
                }
              >
                Einkauf öffnen
              </button>
            </div>
          </div>
          <div className="plan-stage-facts" aria-label="Wochenüberblick">
            {quickFacts.map((fact) => (
              <article key={fact.label} className="stage-stat">
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </article>
            ))}
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

        <section
          className={`workspace-nav-block${mobileMenuHidden ? ' workspace-nav-block-hidden' : ''}`}
          aria-label="Bereiche wechseln"
          data-scroll-state={mobileMenuHidden ? 'hidden' : 'visible'}
        >
          <div className="workspace-pane-switch">
            {workspaceViews.map((view) => (
              <button
                key={view.id}
                type="button"
                className={`workspace-pane-button${activeWorkspacePane === view.id ? ' workspace-pane-button-active' : ''}`}
                aria-label={view.title}
                onClick={() =>
                  startTransition(() => {
                    updateSearchParams(setSearchParams, { pane: view.id });
                  })
                }
                aria-pressed={activeWorkspacePane === view.id}
              >
                <span className="workspace-pane-title">{view.title}</span>
                <strong className="workspace-pane-meta">{view.meta}</strong>
                <span className="workspace-pane-description">{view.description}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="workspace">
          <div className="workspace-main">
            <div className={showPlanPane ? '' : 'workspace-pane-hidden-mobile'}>
              <MealBoard
                planId={currentPlanQuery.data?.id}
                days={currentPlanQuery.data?.days}
                activeDayDate={activeDayDate}
                selectedMealId={selectedMealId}
                favoriteMealIDs={favoriteMealIDs}
                onSelectMeal={selectMealForDay}
                onSelectDay={selectDay}
              />
            </div>
            <div className={showDetailPane ? '' : 'workspace-pane-hidden-mobile'}>
              <MealInspector
                planId={currentPlanQuery.data?.id}
                dayDate={selectedDay?.date}
                meal={inspectedMeal}
                contextNote={selectedDay?.label ?? formatDate(selectedDay?.date)}
                favoriteId={inspectedMeal ? favoriteByMealID.get(inspectedMeal.id) : undefined}
                canActOnMeal={inspectedMealInPlan}
                onToggleFavorite={handleToggleFavorite}
                onRegenerate={handleRegenerate}
                isRegenerating={regenerateMealMutation.isPending}
                isFavoriteBusy={createFavoriteMutation.isPending || deleteFavoriteMutation.isPending}
              />
            </div>
          </div>

          <div className={`workspace-side${showShoppingPane ? '' : ' workspace-pane-hidden-mobile'}`}>
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
        <SparkIcon className="action-icon" />
        Prompt prüfen
      </button>
      {open ? (
        <section className="prompt-debug-panel" aria-label="Prompt Debug Overlay">
          <div className="surface-header">
            <div>
              <span className="eyebrow">Testmodus</span>
              <h2>{latest?.operation ?? 'Prompt'}</h2>
            </div>
            <button type="button" className="icon-button" onClick={onRefresh} aria-label="Prompt-Daten aktualisieren" title="Prompt-Daten aktualisieren">
              <RefreshIcon className="action-icon" />
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

function parsePane(value: string | null): 'plan' | 'detail' | 'shopping' {
  if (value === 'detail' || value === 'shopping') {
    return value;
  }
  return 'plan';
}

function updateSearchParams(
  setSearchParams: SetURLSearchParams,
  updates: Record<string, string | undefined>
) {
  setSearchParams((current) => {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(updates)) {
      if (value && value.trim() !== '') {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    return next;
  }, { replace: true });
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
