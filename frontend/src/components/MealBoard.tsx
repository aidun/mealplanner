import type { Day, Meal } from '../types';
import { formatDate, formatNutritionPerPortion } from '../lib/format';
import { BringLink } from './BringLink';
import { ChevronLeftIcon, ChevronRightIcon, HeartIcon } from './icons';

interface MealBoardProps {
  planId?: string;
  days?: Day[];
  activeDayDate?: string;
  selectedMealId?: string;
  favoriteMealIDs?: Set<string>;
  onSelectMeal: (meal: Meal, dayDate?: string) => void;
  onSelectDay: (dayDate: string, defaultMealId?: string) => void;
}

export function MealBoard({
  planId,
  days = [],
  activeDayDate,
  selectedMealId,
  favoriteMealIDs,
  onSelectMeal,
  onSelectDay,
}: MealBoardProps) {
  const resolvedDayIndex = activeDayDate ? days.findIndex((day) => day.date === activeDayDate) : 0;
  const safeDayIndex =
    days.length === 0 ? 0 : resolvedDayIndex >= 0 ? resolvedDayIndex : 0;
  const activeDay = days[safeDayIndex];
  const leadMeal = activeDay?.meals[0];
  const boardNarrative = activeDay
    ? leadMeal
      ? `${activeDay.label ?? formatDate(activeDay.date)} beginnt mit ${leadMeal.title}.`
      : `${activeDay.label ?? formatDate(activeDay.date)} ist noch frei.`
    : 'Die Woche lässt sich direkt Tag für Tag öffnen.';

  const selectDay = (index: number) => {
    const day = days[index];
    const firstMeal = day?.meals[0];
    if (!day) return;
    onSelectDay(day.date, firstMeal?.id);
    if (firstMeal) {
      onSelectMeal(firstMeal, day.date);
    }
  };

  const moveDay = (direction: -1 | 1) => {
    if (days.length === 0) return;
    selectDay((safeDayIndex + direction + days.length) % days.length);
  };

  return (
    <section className="surface meal-board-surface">
      <div className="surface-header">
        <div>
          <h2>Diese Woche auf dem Tisch</h2>
          <p>{boardNarrative}</p>
        </div>
        {days.length > 0 ? (
          <div className="carousel-actions" aria-label="Tage wechseln">
            <button type="button" className="button button-secondary carousel-button icon-button" onClick={() => moveDay(-1)} aria-label="Zurück" title="Zurück">
              <ChevronLeftIcon className="action-icon" />
            </button>
            <button type="button" className="button button-secondary carousel-button icon-button" onClick={() => moveDay(1)} aria-label="Weiter" title="Weiter">
              <ChevronRightIcon className="action-icon" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="day-overview-grid" aria-label="Wochentage">
        {days.map((day, index) => (
          <button
            key={day.date}
            type="button"
            className={`day-tab${index === safeDayIndex ? ' day-tab-active' : ''}`}
            aria-current={index === safeDayIndex ? 'date' : undefined}
            onClick={() => selectDay(index)}
          >
            <span>{day.label ?? formatDayRailLabel(day.date, index)}</span>
            <strong>{day.meals[0]?.title ?? 'Noch offen'}</strong>
            <small>
              {day.meals.length > 0 ? `${day.meals.length} Gericht${day.meals.length > 1 ? 'e' : ''}` : formatDayBadge(day.date)}
            </small>
          </button>
        ))}
      </div>

      <div className="board-carousel" aria-live="polite">
        {days.length === 0 ? (
          <div className="empty-state">
            <h3>Noch kein Wochenplan</h3>
            <p>Zum Beispiel: Montag Pasta al Limone, Dienstag Ofengemüse und Freitag eine schnelle Suppe.</p>
          </div>
        ) : activeDay ? (
          <section key={activeDay.date} className="day-column" aria-label={activeDay.label ?? activeDay.date}>
            <header className="day-header">
              <div className="day-header-copy">
                <h3>{activeDay.label ?? formatDate(activeDay.date)}</h3>
                <p>
                  {leadMeal
                    ? `${formatDate(activeDay.date)} · ${leadMeal.title}`
                    : `${formatDate(activeDay.date)} · Hier fehlt noch ein Gericht für euren Alltag`}
                </p>
              </div>
              <div className="day-header-meta">
                <span className="day-header-badge">
                  {activeDay.meals.length > 0 ? `${activeDay.meals.length} Gericht${activeDay.meals.length > 1 ? 'e' : ''}` : 'Noch offen'}
                </span>
              </div>
              <BringLink
                planId={planId}
                scope={{ day: activeDay.date }}
                label="Tag zu Bring"
                className="button button-secondary bring-export-button compact-action"
                disabled={activeDay.meals.length === 0}
              />
            </header>

            <div className="meal-stack">
              {activeDay.meals.length === 0 ? (
                <p className="muted">Keine Mahlzeiten eingeplant.</p>
              ) : (
                activeDay.meals.map((meal) => {
                  const active = meal.id === selectedMealId;
                  const servingsLabel = meal.servings.length > 0 ? `${meal.servings.length} Portionen` : 'Portion offen';
                  return (
                    <button
                      key={meal.id}
                      type="button"
                      className={`meal-row${active ? ' meal-row-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => onSelectMeal(meal, activeDay.date)}
                    >
                      <div className="meal-row-topline">
                        <div className="meal-row-heading">
                          <span className="slot-label">{slotLabel(meal.slot)}</span>
                          {favoriteMealIDs?.has(meal.id) ? (
                            <span className="meal-favorite-mark" aria-label="Favorit">
                              <HeartIcon className="meal-favorite-icon" />
                            </span>
                          ) : null}
                        </div>
                        <span className="meal-title">{meal.title}</span>
                      </div>
                      <div className="meal-row-meta">
                        <div className="nutrition-line">
                          {servingsLabel}
                          {formatNutritionPerPortion(meal.nutrition) ? ' · ' : ''}
                          {formatNutritionPerPortion(meal.nutrition)}
                          {meal.estimatedNutrition ? ' · geschätzt' : ''}
                        </div>
                        <span className="meal-row-state">{active ? 'Offen' : 'Rezept öffnen'}</span>
                      </div>
                      {meal.tags.length > 0 ? (
                        <div className="meal-tag-row" aria-label="Gerichtsmarkierungen">
                          {meal.tags.slice(0, 3).map((tag) => (
                            <span key={`${meal.id}-${tag}`} className="meal-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function formatDayRailLabel(value: string, index: number) {
  if (index === 0) return 'Heute';
  if (index === 1) return 'Morgen';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
  }).format(date);
}

function slotLabel(slot?: string) {
  switch (slot) {
    case 'breakfast':
      return 'Frühstück';
    case 'lunch':
      return 'Mittagessen';
    case 'dinner':
      return 'Abendessen';
    case 'snack':
      return 'Snack';
    default:
      return slot || 'Mahlzeit';
  }
}

function formatDayBadge(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}
