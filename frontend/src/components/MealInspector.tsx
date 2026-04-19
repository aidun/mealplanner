import { useEffect, useState } from 'react';
import type { Meal } from '../types';
import { formatNutrition } from '../lib/format';

interface MealInspectorProps {
  meal?: Meal;
  onRegenerate: (note: string) => void;
  isRegenerating: boolean;
}

export function MealInspector({ meal, onRegenerate, isRegenerating }: MealInspectorProps) {
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
        <p className="muted">Hier erscheinen Zutaten, Zubereitung und die Regenerierung mit Notiz.</p>
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
          <p>{formatNutrition(meal.nutrition) || 'Keine Angaben'}{meal.estimatedNutrition ? ' · geschätzt' : ''}</p>
        </div>

        <div>
          <label className="field-label" htmlFor="regenerate-note">
            Notiz für Neu-Generierung
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
            {isRegenerating ? 'Wird neu generiert' : 'Mahlzeit neu generieren'}
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
