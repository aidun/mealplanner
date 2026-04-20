import type { Day, Meal } from '../types';
import { formatDate, formatNutrition } from '../lib/format';

interface MealBoardProps {
  days?: Day[];
  selectedMealId?: string;
  onSelectMeal: (meal: Meal) => void;
}

export function MealBoard({ days = [], selectedMealId, onSelectMeal }: MealBoardProps) {
  return (
    <section className="surface">
      <div className="surface-header">
        <div>
          <h2>Diese Woche auf dem Tisch</h2>
          <p>Frühstück, Mittag, Abendessen und Snacks für eure Familie.</p>
        </div>
      </div>

      <div className="board-grid">
        {days.length === 0 ? (
          <div className="empty-state">
            <h3>Noch kein Wochenplan</h3>
            <p>Starte eine neue Woche und lass den Plan aus eurem Familienprofil entstehen.</p>
          </div>
        ) : (
          days.map((day) => (
            <section key={day.date} className="day-column" aria-label={day.label ?? day.date}>
              <header className="day-header">
                <div>
                  <h3>{day.label ?? formatDate(day.date)}</h3>
                  <p>{formatDate(day.date)}</p>
                </div>
              </header>

              <div className="meal-stack">
                {day.meals.length === 0 ? (
                  <p className="muted">Keine Mahlzeiten eingeplant.</p>
                ) : (
                  day.meals.map((meal) => {
                    const active = meal.id === selectedMealId;
                    return (
                      <button
                        key={meal.id}
                        type="button"
                        className={`meal-row${active ? ' meal-row-active' : ''}`}
                        aria-pressed={active}
                        onClick={() => onSelectMeal(meal)}
                      >
                        <div className="meal-row-topline">
                          <span className="slot-label">{meal.slot ?? 'Mahlzeit'}</span>
                          <span className="meal-title">{meal.title}</span>
                        </div>
                        {meal.description ? <p>{meal.description}</p> : null}
                        <div className="tag-row">
                          {meal.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="nutrition-line">
                          {formatNutrition(meal.nutrition)}
                          {meal.estimatedNutrition ? ' · geschätzt' : ''}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          ))
        )}
      </div>
    </section>
  );
}
