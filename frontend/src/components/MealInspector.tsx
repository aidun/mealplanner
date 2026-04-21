import { useEffect, useState } from 'react';
import type { Meal } from '../types';
import { formatNutrition, formatNutritionPerPortion, scaleNutrition } from '../lib/format';
import { detectCriticalAllergens, inferSelectionReason } from '../lib/meal-insights';
import { BringLink } from './BringLink';
import { HeartIcon, InfoIcon, RefreshIcon, ShieldIcon, SparkIcon } from './icons';

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
  const [showRecipeContext, setShowRecipeContext] = useState(false);
  const [showSelectionReason, setShowSelectionReason] = useState(false);
  const allergens = meal ? detectCriticalAllergens(meal.ingredients) : [];
  const selectionReason = meal ? inferSelectionReason(meal) : '';

  useEffect(() => {
    setNote('');
    setShowRecipeContext(false);
    setShowSelectionReason(false);
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
            className={`icon-button${favoriteId ? ' icon-button-active' : ''}`}
            onClick={() => onToggleFavorite?.(meal, favoriteId)}
            disabled={!onToggleFavorite || isFavoriteBusy}
            aria-pressed={Boolean(favoriteId)}
            aria-label={favoriteId ? 'Favorit entfernen' : 'Als Favorit merken'}
            title={favoriteId ? 'Favorit entfernen' : 'Als Favorit merken'}
          >
            <HeartIcon className="action-icon" />
          </button>
          <button
            type="button"
            className={`icon-button${showRecipeContext ? ' icon-button-active' : ''}`}
            onClick={() => setShowRecipeContext((current) => !current)}
            aria-pressed={showRecipeContext}
            aria-label="Rezeptkontext anzeigen"
            title="Rezeptkontext anzeigen"
          >
            <InfoIcon className="action-icon" />
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
      <div className="inspector-inline-actions">
        <button
          type="button"
          className={`button button-secondary compact-action action-pill${showSelectionReason ? ' action-pill-active' : ''}`}
          onClick={() => setShowSelectionReason((current) => !current)}
        >
          <SparkIcon className="pill-icon" />
          Warum gewaehlt?
        </button>
      </div>
      {showRecipeContext ? (
        <div className="inspector-info-panel" role="note">
          <p>
            <strong>Herkunft:</strong> {mealOriginLabel(meal)}
          </p>
          {meal.meta?.favoriteReuse ? (
            <p>
              {meal.meta.favoriteReuse === 'variant'
                ? 'Dieses Gericht lehnt sich an einen vorhandenen Favoriten an.'
                : 'Dieses Gericht wurde aus eurer Favoriten-Sammlung wieder aufgegriffen.'}
              {meal.meta.favoriteTitle ? ` Bezug: ${meal.meta.favoriteTitle}.` : ''}
            </p>
          ) : null}
          {meal.regenerationNote ? <p>Beruecksichtigt: {meal.regenerationNote}</p> : null}
          {!canActOnMeal ? <p>Dieses Rezept liegt gerade in eurer Sammlung. Aktionen greifen wieder im aktiven Wochenplan.</p> : null}
        </div>
      ) : null}
      {showSelectionReason ? (
        <div className="inspector-info-panel" role="note">
          <p>{selectionReason}</p>
        </div>
      ) : null}

      <div className="inspector-summary-grid">
        <div className="inspector-summary-card">
          <strong>{formatNutritionPerPortion(meal.nutrition) || 'Keine Angaben'}</strong>
          <span>
            {hasUnevenServings(meal) ? 'Basisportion' : 'Naehrwerte pro Portion'}
            {meal.meta?.nutritionSource === 'ingredients' ? ' · aus Zutaten' : ''}
          </span>
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
                  {scaledNutritionLabel(meal, serving.factor) ? ` · ${scaledNutritionLabel(meal, serving.factor)}` : ''}
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
            className="button button-primary full-width regenerate-button"
            onClick={() => onRegenerate(note)}
            disabled={isRegenerating || !canActOnMeal}
            aria-label="Gericht austauschen"
          >
            <RefreshIcon className="pill-icon" />
            {isRegenerating ? 'Wir suchen ein anderes Gericht' : 'Neu generieren'}
          </button>
        </section>
        {meal.warnings?.length || allergens.length > 0 ? (
          <section className="inspector-section">
            <h3>Hinweise</h3>
            {meal.warnings?.map((warning, index) => (
              <p key={`${meal.id}-warning-${index}`} className="inspector-warning">
                {warning}
              </p>
            ))}
            {allergens.length > 0 ? (
              <div className="allergy-warning" role="note">
                <div className="allergy-warning-title">
                  <ShieldIcon className="pill-icon" />
                  <strong>Kritische Produkte erkannt</strong>
                </div>
                <p>
                  Moeglicherweise enthalten: {allergens.join(', ')}. Dieser Hinweis wird automatisch aus den Zutaten
                  abgeleitet und ersetzt keine manuelle Allergiepruefung.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}
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

function scaledNutritionLabel(meal: Meal, factor?: number) {
  const safeFactor = factor && factor > 0 ? factor : 1;
  if (Math.abs(safeFactor - 1) < 0.001) {
    return '';
  }
  const scaled = scaleNutrition(meal.nutrition, safeFactor);
  return formatNutrition(scaled);
}

function mealOriginLabel(meal: Meal) {
  if (meal.meta?.favoriteReuse === 'variant') {
    return 'Variante aus eurer Sammlung';
  }
  if (meal.meta?.favoriteReuse === 'direct') {
    return 'Direkt aus eurer Sammlung';
  }
  return 'Neu fuer diese Woche geplant';
}
