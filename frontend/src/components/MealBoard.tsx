import { useEffect, useState } from 'react';
import type { Day, Meal } from '../types';
import { formatDate, formatNutritionPerPortion } from '../lib/format';
import { BringLink } from './BringLink';
import { ChevronLeftIcon, ChevronRightIcon, HeartIcon } from './icons';

interface MealBoardProps {
  planId?: string;
  days?: Day[];
  selectedMealId?: string;
  favoriteMealIDs?: Set<string>;
  onSelectMeal: (meal: Meal) => void;
}

export function MealBoard({ planId, days = [], selectedMealId, favoriteMealIDs, onSelectMeal }: MealBoardProps) {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const safeDayIndex = days.length === 0 ? 0 : Math.min(activeDayIndex, days.length - 1);
  const activeDay = days[safeDayIndex];

  useEffect(() => {
    if (activeDayIndex > 0 && activeDayIndex >= days.length) {
      setActiveDayIndex(Math.max(days.length - 1, 0));
    }
  }, [activeDayIndex, days.length]);

  const selectDay = (index: number) => {
    setActiveDayIndex(index);
    const firstMeal = days[index]?.meals[0];
    if (firstMeal) {
      onSelectMeal(firstMeal);
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
          <p>Tage prüfen, Gericht auswählen und danach rechts die Details anpassen.</p>
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

      <div className="day-tabs" aria-label="Wochentage">
        {days.map((day, index) => (
          <button
            key={day.date}
            type="button"
            className={`day-tab${index === safeDayIndex ? ' day-tab-active' : ''}`}
            aria-current={index === safeDayIndex ? 'date' : undefined}
            onClick={() => selectDay(index)}
          >
            <span>{day.label ?? formatDate(day.date)}</span>
            <strong>{formatDate(day.date)}</strong>
            <small>{day.meals.length} Mahlzeiten</small>
          </button>
        ))}
      </div>

      <div className="board-carousel" aria-live="polite">
        {days.length === 0 ? (
          <div className="empty-state">
            <h3>Noch kein Wochenplan</h3>
            <p>Startet eine neue Woche mit Gerichten, die zu eurem Alltag passen.</p>
          </div>
        ) : activeDay ? (
          <section key={activeDay.date} className="day-column" aria-label={activeDay.label ?? activeDay.date}>
            <header className="day-header">
              <div>
                <h3>{activeDay.label ?? formatDate(activeDay.date)}</h3>
                <p>{formatDate(activeDay.date)} · {activeDay.meals.length} Mahlzeiten</p>
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
                      onClick={() => onSelectMeal(meal)}
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
                        {active ? <span className="meal-row-state">Aktiv</span> : null}
                      </div>
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
