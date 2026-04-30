import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams, type SetURLSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { ChevronLeftIcon, ChevronRightIcon, RefreshIcon, SparkIcon } from '../components/icons';
import { MealBoard } from '../components/MealBoard';
import { MealInspector } from '../components/MealInspector';
import { PlanBackdrop } from '../components/PlanBackdrop';
import { ShoppingListPanel } from '../components/ShoppingListPanel';
import { readableApiError } from '../lib/api-error';
import { formatDate, formatWeekRange, parseDateOnly } from '../lib/format';
import { LoginPage } from './LoginPage';
import {
  createPlan,
  createFavorite,
  deleteFavorite,
  generateMeal,
  getCurrentPlan,
  getFavorites,
  getLatestPromptDebug,
  getPlanByWeek,
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

// DashboardPage is the main workspace: URL params keep the active pane, day and meal shareable.
export function DashboardPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const promptDebug = promptDebugEnabled();
  const [loggedOut, setLoggedOut] = useState(false);
  const [mobileMenuHidden, setMobileMenuHidden] = useState(false);
  const [singleMealSlot, setSingleMealSlot] = useState('dinner');
  const [singleMealNote, setSingleMealNote] = useState('');
  const lastScrollYRef = useRef(0);
  const scrollTickingRef = useRef(false);
  const mobileMenuHiddenRef = useRef(false);
  const activeWorkspacePane = parsePane(searchParams.get('pane'));
  const selectedMealId = searchParams.get('meal') ?? undefined;
  const selectedDayParam = searchParams.get('day') ?? undefined;
  const selectedWeekParam = normalizeWeekStart(searchParams.get('week') ?? undefined);

  const planQueryKey = ['current-plan', selectedWeekParam ?? 'latest'];
  const currentPlanQuery = useQuery({
    queryKey: planQueryKey,
    queryFn: () => (selectedWeekParam ? getPlanByWeek(selectedWeekParam) : getCurrentPlan()),
  });
  const visibleWeekStart = selectedWeekParam ?? currentPlanQuery.data?.weekStart ?? nextMondayISO();
  const hasVisiblePlan = Boolean(currentPlanQuery.data?.id);
  const planActionLabel = hasVisiblePlan ? 'Woche neu planen' : 'Woche planen';

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
    mutationFn: () => createPlan({ weekStart: visibleWeekStart }),
    onSuccess: async (createdPlan) => {
      if (createdPlan) {
        queryClient.setQueryData(['current-plan', createdPlan.weekStart], createdPlan);
      }
      updateSearchParams(setSearchParams, {
        pane: 'plan',
        week: createdPlan?.weekStart ?? visibleWeekStart,
        meal: createdPlan?.days?.flatMap((day) => day.meals)[0]?.id,
        day: createdPlan?.days?.find((day) => day.meals.length > 0)?.date ?? createdPlan?.days?.[0]?.date,
      });
      await queryClient.invalidateQueries({ queryKey: ['current-plan'] });
      await queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });

  const regenerateMealMutation = useMutation({
    mutationFn: ({ planId, mealId, note }: { planId: string; mealId: string; note: string }) =>
      regenerateMeal(planId, mealId, note),
    onSuccess: async (updatedPlan) => {
      if (updatedPlan) {
        queryClient.setQueryData(planQueryKey, updatedPlan);
      }
      updateSearchParams(setSearchParams, { pane: 'detail' });
      await queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });

  const generateMealMutation = useMutation({
    mutationFn: ({ planId, dayDate, slot, note }: { planId: string; dayDate: string; slot: string; note: string }) =>
      generateMeal(planId, { dayDate, slot, note }),
    onSuccess: async (updatedPlan, variables) => {
      if (updatedPlan) {
        queryClient.setQueryData(planQueryKey, updatedPlan);
        queryClient.setQueryData(['current-plan', updatedPlan.weekStart], updatedPlan);
        const meal = updatedPlan.days
          .find((day) => day.date === variables.dayDate)
          ?.meals.find((entry) => entry.slot === variables.slot);
        updateSearchParams(setSearchParams, {
          pane: 'detail',
          week: selectedWeekParam ? updatedPlan.weekStart : undefined,
          day: variables.dayDate,
          meal: meal?.id,
        });
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
  const allDays = currentPlanQuery.data?.days ?? [];
  const weekDayOptions = allDays.length > 0 ? allDays : buildWeekDays(visibleWeekStart);
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
    // On mobile the pane switcher hides only while scrolling down, keeping the hero stable.
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

  const selectWeek = (weekStart: string) => {
    const normalized = normalizeWeekStart(weekStart);
    updateSearchParams(setSearchParams, { week: normalized, day: normalized, meal: undefined, pane: 'plan' });
  };

  const shiftWeek = (days: number) => {
    selectWeek(addDaysISO(visibleWeekStart, days));
  };

  const singleMealDay = activeDayDate ?? currentPlanQuery.data?.days[0]?.date ?? visibleWeekStart;
  const setSingleMealDay = (dayDate: string) => {
    updateSearchParams(setSearchParams, { day: dayDate, meal: undefined, pane: activeWorkspacePane });
  };

  const handleGenerateMeal = () => {
    const plan = currentPlanQuery.data;
    if (!plan?.id || !singleMealDay || !singleMealSlot) return;
    generateMealMutation.mutate({
      planId: plan.id,
      dayDate: singleMealDay,
      slot: singleMealSlot,
      note: singleMealNote.trim(),
    });
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
  const generateMealMessage = generateMealMutation.isError
    ? readableApiError(generateMealMutation.error, 'Der Einzelvorschlag konnte gerade nicht erstellt werden. Bitte versuche es noch einmal.')
    : generateMealMutation.isSuccess
      ? 'Der Einzelvorschlag ist fertig.'
      : '';
  const logoutMessage = logoutMutation.isError ? 'Logout gerade nicht möglich. Bitte versuche es erneut.' : '';
  const shoppingItemCount = shoppingListQuery.data ? countShoppingItems(shoppingListQuery.data) : 0;
  const selectedDayLabel = formatDate(selectedDay?.date) || selectedDay?.label;
  const workspaceViews = [
    {
      id: 'plan' as const,
      title: 'Plan',
      description: selectedDayLabel
        ? `${selectedDayLabel}: ${selectedDay?.meals[0]?.title ?? 'noch offen'}`
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
  const weekRangeLabel = formatWeekRange(visibleWeekStart);
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
      value: inspectedMeal?.title ?? selectedDayLabel ?? 'Tag auswählen',
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
        weekStart={visibleWeekStart}
        onCreatePlan={() => createPlanMutation.mutate()}
        creatingPlan={createPlanMutation.isPending}
        createPlanLabel={planActionLabel}
        onLogout={() => logoutMutation.mutate()}
        loggingOut={logoutMutation.isPending}
        isAdmin={Boolean(session?.isAdmin)}
      />

      <main className="app-main">
        <section className="plan-stage" aria-labelledby="home-title">
          <PlanBackdrop />
          <div className="plan-stage-head">
            <div className="plan-stage-copy">
              <span className="eyebrow">Wochenstudio</span>
              <h1 id="home-title">Woche, Rezept und Einkauf an einem Tisch</h1>
              <p>{stageNarrative}</p>
            </div>
            <div className="plan-stage-actions">
              <Link to="/onboarding" className="button button-secondary">
                Profil öffnen
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
          <div className="week-control-bar" aria-label="Wochensteuerung">
            <button type="button" className="icon-button week-step-button" onClick={() => shiftWeek(-7)} aria-label="Vorherige Woche" title="Vorherige Woche">
              <ChevronLeftIcon className="action-icon" />
            </button>
            <label className="field week-date-field">
              <span className="field-label">Woche auswählen</span>
              <input
                className="input"
                type="date"
                value={visibleWeekStart}
                onChange={(event) => selectWeek(event.target.value)}
              />
            </label>
            <button type="button" className="icon-button week-step-button" onClick={() => shiftWeek(7)} aria-label="Nächste Woche" title="Nächste Woche">
              <ChevronRightIcon className="action-icon" />
            </button>
            <div className="single-meal-control" aria-label="Einzelvorschlag">
              <label className="field">
                <span className="field-label">Tag für Einzelvorschlag</span>
                <select className="input" value={singleMealDay} onChange={(event) => setSingleMealDay(event.target.value)}>
                  {weekDayOptions.map((day) => (
                    <option key={day.date} value={day.date}>
                      {formatDate(day.date)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Mahlzeit für Einzelvorschlag</span>
                <select className="input" value={singleMealSlot} onChange={(event) => setSingleMealSlot(event.target.value)}>
                  <option value="breakfast">Frühstück</option>
                  <option value="lunch">Mittagessen</option>
                  <option value="dinner">Abendessen</option>
                  <option value="snack">Snack</option>
                </select>
              </label>
              <label className="field single-meal-note">
                <span className="field-label">Wunsch für Einzelvorschlag</span>
                <input
                  className="input"
                  value={singleMealNote}
                  onChange={(event) => setSingleMealNote(event.target.value)}
                  placeholder="Airfryer, schnell, mild"
                />
              </label>
              <button
                type="button"
                className="button button-secondary single-meal-button"
                onClick={handleGenerateMeal}
                disabled={!currentPlanQuery.data?.id || generateMealMutation.isPending}
              >
                {generateMealMutation.isPending ? 'Gericht läuft…' : 'Ein Gericht vorschlagen'}
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

        {planMessage || regenerateMessage || generateMealMessage || logoutMessage ? (
          <div
            className={`status-strip${createPlanMutation.isError || regenerateMealMutation.isError || generateMealMutation.isError || currentPlanQuery.isError || logoutMutation.isError ? ' status-strip-error' : ' status-strip-success'}`}
            role={createPlanMutation.isError || regenerateMealMutation.isError || generateMealMutation.isError || currentPlanQuery.isError || logoutMutation.isError ? 'alert' : 'status'}
            aria-live="polite"
          >
            <span>{planMessage || regenerateMessage || generateMealMessage || logoutMessage}</span>
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

        <div className="workspace workspace-pitch">
          <div className={`workspace-board${showPlanPane ? '' : ' workspace-pane-hidden-mobile'}`}>
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

          <aside className="workspace-rail" aria-label="Rezept und Einkauf">
            <div className={showDetailPane ? 'workspace-rail-pane' : 'workspace-rail-pane workspace-pane-hidden-mobile'}>
              <MealInspector
                planId={currentPlanQuery.data?.id}
                dayDate={selectedDay?.date}
                meal={inspectedMeal}
                contextNote={selectedDayLabel}
                favoriteId={inspectedMeal ? favoriteByMealID.get(inspectedMeal.id) : undefined}
                canActOnMeal={inspectedMealInPlan}
                onToggleFavorite={handleToggleFavorite}
                onRegenerate={handleRegenerate}
                isRegenerating={regenerateMealMutation.isPending}
                isFavoriteBusy={createFavoriteMutation.isPending || deleteFavoriteMutation.isPending}
              />
            </div>

            <div className={showShoppingPane ? 'workspace-rail-pane workspace-shopping-pane' : 'workspace-rail-pane workspace-shopping-pane workspace-pane-hidden-mobile'}>
              <ShoppingListPanel
                planId={currentPlanQuery.data?.id}
                shoppingList={shoppingListQuery.data ?? null}
                loading={shoppingListQuery.isLoading}
              />
            </div>
          </aside>
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
  // The overlay summarizes prompt history and OpenAI metrics without exposing it in production builds.
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
  // Token and request metrics arrive as separate series; merge them for a compact operator view.
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

function normalizeWeekStart(value?: string) {
  const date = parseDateOnly(value);
  if (!date) return undefined;
  const weekday = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - (weekday - 1));
  return toDateInputValue(date);
}

function nextMondayISO() {
  const date = new Date();
  const delta = (1 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + delta);
  return toDateInputValue(date);
}

function addDaysISO(value: string, days: number) {
  const date = parseDateOnly(value) ?? new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function buildWeekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = parseDateOnly(weekStart) ?? new Date();
    date.setDate(date.getDate() + index);
    return { date: toDateInputValue(date), meals: [] };
  });
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateSearchParams(
  setSearchParams: SetURLSearchParams,
  updates: Record<string, string | undefined>
) {
  // Replace history entries so pane/day/meal navigation does not pollute the browser back stack.
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
  // Accept both legacy flat shopping lists and the newer sectioned document returned by the API.
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
