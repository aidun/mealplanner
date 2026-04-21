import { useEffect, useState } from 'react';
import type { Meal } from '../types';
import { formatNutritionPerPortion } from '../lib/format';
import { BringLink } from './BringLink';

interface MealInspectorProps {
  planId?: string;
  dayDate?: string;
  meal?: Meal;
  favoriteId?: string;
  contextNote?: string;
  canActOnMeal?: boolean;
  onToggleFavorite?: (meal: Meal, favoriteId?: string) => void;
  onRegenerate: (note: string) => void;
  isRegenerating: boolean;
  isFavoriteBusy?: boolean;
}

export function MealInspector({
  planId,
  dayDate,
  meal,
  favoriteId,
  contextNote,
  canActOnMeal = true,
  onToggleFavorite,
  onRegenerate,
  isRegenerating,
  isFavoriteBusy,
}: MealInspectorProps) {
  const [note, setNote] = useState('');

  useEffect(() => {
    setNote('');
  }, [meal?.id]);

  if (!meal) {
    return (
      <section className="surface inspector">
        <div className="surface-header">
          <div>
            <h2>Mahlzeit</h2>
            <p>Wähle eine Mahlzeit im Wochenboard aus.</p>
          </div>
        </div>
        <p className="muted">Hier erscheinen Zutaten, Zubereitung und die schnelle Änderung.</p>
      </section>
    );
  }

  return (
    <section className="surface inspector">
      <div className="surface-header">
        <div>
          <h2>{meal.title}</h2>
          <p>
            {meal.slot ?? 'Mahlzeit'}
            {dayDate ? ` fuer ${dayDate}` : ''}
            {contextNote ? ` · ${contextNote}` : ''}
          </p>
        </div>
        <div className="surface-actions">
          <button
            type="button"
            className="button button-secondary compact-action"
            onClick={() => onToggleFavorite?.(meal, favoriteId)}
            disabled={!onToggleFavorite || isFavoriteBusy}
            aria-pressed={Boolean(favoriteId)}
          >
            {favoriteId ? 'Favorit entfernen' : 'Als Favorit merken'}
          </button>
          <BringLink
            planId={planId}
            scope={{ day: dayDate, meal: meal.id }}
            label="Rezept zu Bring"
            className="button button-secondary bring-export-button compact-action"
            disabled={!canActOnMeal}
          />
        </div>
      </div>

      {meal.description ? <p className="inspector-copy">{meal.description}</p> : null}
      {meal.meta?.favoriteReuse ? (
        <p className="inspector-note" role="note">
          Dieses Gericht wurde aus eurer Favoriten-Sammlung wieder aufgegriffen.
          {meal.meta.favoriteTitle ? ` Bezug: ${meal.meta.favoriteTitle}.` : ''}
        </p>
      ) : null}
      {meal.regenerationNote ? (
        <p className="inspector-note" role="note">
          Berücksichtigt: {meal.regenerationNote}
        </p>
      ) : null}
      {!canActOnMeal ? (
        <p className="inspector-note" role="note">
          Dieses Rezept kommt gerade aus eurer Sammlung. Bring und Regeneration stehen im aktiven Wochenplan bereit.
        </p>
      ) : null}

      <div className="inspector-summary-grid">
        <div className="inspector-summary-card">
          <strong>{formatNutritionPerPortion(meal.nutrition) || 'Keine Angaben'}</strong>
          <span>Nährwerte pro Portion</span>
        </div>
        <div className="inspector-summary-card">
          <strong>{meal.ingredients.length}</strong>
          <span>Zutaten</span>
        </div>
        <div className="inspector-summary-card">
          <strong>{meal.instructions.length}</strong>
          <span>Schritte</span>
        </div>
      </div>

      <div className="stack inspector-stack">
        <section className="inspector-section">
          <h3>Zutaten</h3>
          <ul className="list ingredient-list">
            {meal.ingredients.map((ingredient, index) => (
              <li key={`${ingredient.name}-${index}`} className="ingredient-row">
                <span className="ingredient-amount">
                  {ingredient.amount ? `${ingredient.amount}${ingredient.unit ? ` ${ingredient.unit}` : ''}` : 'nach Bedarf'}
                </span>
                <div className="ingredient-copy">
                  <strong>{ingredient.name}</strong>
                  {ingredient.note ? <span>{ingredient.note}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="inspector-section">
          <h3>Schritte</h3>
          <ol className="list ordered-list step-list">
            {meal.instructions.map((step, index) => (
              <li key={`${meal.id}-step-${index}`} className="step-row">
                <span className="step-index">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {meal.servings.length > 0 ? (
          <section className="inspector-section">
            <h3>Portionen</h3>
            {hasUnevenServings(meal) ? (
              <p className="panel-feedback" role="note">
                Die Aufteilung ist nicht gleichmäßig. Nährwerte beziehen sich auf die angegebene Portion.
              </p>
            ) : null}
            <ul className="list">
              {meal.servings.map((serving) => (
                <li key={`${meal.id}-${serving.memberId}`}>
                  <strong>{serving.name || serving.memberId}</strong>
                  {serving.portion ? ` · ${serving.portion}` : ''}
                  {serving.factor && serving.factor !== 1 ? ` · Faktor ${serving.factor}` : ''}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="inspector-section">
          <label className="field-label" htmlFor="regenerate-note">
            Wunsch zur Änderung
          </label>
          <textarea
            id="regenerate-note"
            className="input textarea"
            rows={5}
            placeholder="Zum Beispiel: weniger Chili, mehr Gemüse, kindgerechter."
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onInput={(event) => setNote((event.target as HTMLTextAreaElement).value)}
            disabled={!canActOnMeal}
          />
          <button
            type="button"
            className="button button-primary full-width"
            onClick={() => onRegenerate(note)}
            disabled={isRegenerating || !canActOnMeal}
          >
            {isRegenerating ? 'Wir suchen ein anderes Gericht' : 'Gericht austauschen'}
          </button>
        </section>
      </div>

      {meal.tags.length > 0 ? (
        <div className="tag-row tag-row-spaced">
          {meal.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function hasUnevenServings(meal: Meal) {
  if (meal.servings.length < 2) return false;
  const first = meal.servings[0]?.factor ?? 1;
  return meal.servings.some((serving) => Math.abs((serving.factor ?? 1) - first) > 0.001);
}
