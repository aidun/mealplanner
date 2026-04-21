import { useEffect, useState } from 'react';
import type { Meal } from '../types';
import { formatNutritionPerPortion } from '../lib/format';
import { BringLink } from './BringLink';

interface MealInspectorProps {
  planId?: string;
  dayDate?: string;
  meal?: Meal;
  onRegenerate: (note: string) => void;
  isRegenerating: boolean;
}

export function MealInspector({ planId, dayDate, meal, onRegenerate, isRegenerating }: MealInspectorProps) {
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
          <p>{meal.slot ?? 'Mahlzeit'}</p>
        </div>
        <BringLink
          planId={planId}
          scope={{ day: dayDate, meal: meal.id }}
          label="Rezept zu Bring"
          className="button button-secondary bring-export-button compact-action"
        />
      </div>

      {meal.description ? <p className="inspector-copy">{meal.description}</p> : null}

      <div className="stack">
        <div>
          <h3>Zutaten</h3>
          <ul className="list">
            {meal.ingredients.map((ingredient, index) => (
              <li key={`${ingredient.name}-${index}`}>
                <strong>{ingredient.name}</strong>
                {ingredient.amount ? ` · ${ingredient.amount}${ingredient.unit ? ` ${ingredient.unit}` : ''}` : ''}
                {ingredient.note ? ` · ${ingredient.note}` : ''}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Schritte</h3>
          <ol className="list ordered-list">
            {meal.instructions.map((step, index) => (
              <li key={`${meal.id}-step-${index}`}>{step}</li>
            ))}
          </ol>
        </div>

        <div>
          <h3>Nährwerte</h3>
          <p>
            {formatNutritionPerPortion(meal.nutrition) || 'Keine Angaben'}
            {meal.estimatedNutrition ? ' · geschätzt' : ''}
          </p>
        </div>

        {meal.servings.length > 0 ? (
          <div>
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
          </div>
        ) : null}

        <div>
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
          />
          <button
            type="button"
            className="button button-primary full-width"
            onClick={() => onRegenerate(note)}
            disabled={isRegenerating}
          >
            {isRegenerating ? 'Wir suchen ein anderes Gericht' : 'Gericht austauschen'}
          </button>
        </div>
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
