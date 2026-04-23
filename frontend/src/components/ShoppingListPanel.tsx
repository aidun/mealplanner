import { useMemo, useState } from 'react';
import { BringLink } from './BringLink';
import type { ShoppingList, ShoppingListItem } from '../types';
import { ChevronDownIcon, ChevronUpIcon, ShieldIcon } from './icons';

interface ShoppingListPanelProps {
  planId?: string;
  shoppingList?: ShoppingList | null;
  loading: boolean;
}

export function ShoppingListPanel({ planId, shoppingList, loading }: ShoppingListPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const items = useMemo(() => flattenShoppingList(shoppingList), [shoppingList]);
  const categories = useMemo(() => uniqueCategories(items), [items]);
  const groupedItems = useMemo(() => groupByCategory(items), [items]);
  const prominentCategories = categories.slice(0, 3);
  const summary = !Array.isArray(shoppingList) ? shoppingList?.summary : undefined;
  const canExport = Boolean(planId && items.length > 0);
  const checkedItems = items.filter((item) => item.checked).length;
  const remainingItems = Math.max(0, items.length - checkedItems);
  const progress = items.length > 0 ? Math.round((checkedItems / items.length) * 100) : 0;

  return (
    <section className="surface shopping-list-panel">
      <div className="surface-header">
        <div>
          <h2>Einkauf für diese Woche</h2>
          <p>
            {items.length > 0
              ? `${items.length} Artikel${categories.length > 0 ? ` · ${categories.length} ${categories.length === 1 ? 'Abteilung' : 'Abteilungen'}` : ''}`
              : 'Alles für den aktuellen Plan an einem Ort.'}
          </p>
        </div>
        {canExport ? (
          <div className="surface-actions">
            <BringLink planId={planId} label="Woche zu Bring" />
          </div>
        ) : null}
      </div>

      {loading ? <p className="muted shopping-list-loading">Lädt…</p> : null}

      {!loading && !shoppingList ? (
        <div className="empty-state compact">
          <h3>Keine Liste verfügbar</h3>
          <p>Die Einkaufsliste erscheint, sobald ein Plan vorhanden ist.</p>
        </div>
      ) : null}

      {shoppingList ? (
        <div className="stack shopping-list-stack">
          <div className="shopping-list-preview">
            {summary ? <p className="shopping-list-summary">{summary}</p> : null}
            <div className="shopping-progress" aria-label="Einkaufsfortschritt">
              <div className="shopping-progress-copy">
                <strong>{remainingItems > 0 ? `${remainingItems} noch offen` : 'Liste bereit'}</strong>
                <span>
                  {items.length > 0
                    ? `${checkedItems} von ${items.length} Positionen erledigt`
                    : 'Sobald ein Wochenplan vorliegt, entsteht hier euer Einkauf.'}
                </span>
              </div>
              <div className="shopping-progress-track" aria-hidden="true">
                <span className="shopping-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="shopping-list-glance" aria-label="Einkaufslisten Übersicht">
              <div className="shopping-list-metric">
                <strong>{items.length}</strong>
                <span>Produkte</span>
              </div>
              <div className="shopping-list-metric">
                <strong>{categories.length}</strong>
                <span>{categories.length === 1 ? 'Abteilung' : 'Abteilungen'}</span>
              </div>
              <div className="shopping-list-metric shopping-list-metric-wide">
                <strong>{items.slice(0, 4).map((item) => item.name).join(', ') || 'Noch leer'}</strong>
                <span>Als Erstes prüfen</span>
              </div>
            </div>
            {prominentCategories.length > 0 ? (
              <div className="shopping-category-row" aria-label="Schnelle Bereiche">
                {prominentCategories.map((category) => (
                  <span key={category} className="shopping-category-pill">
                    {category}
                  </span>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className="button button-secondary shopping-toggle"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Liste einklappen' : 'Liste aufklappen'}
              title={expanded ? 'Liste einklappen' : 'Liste aufklappen'}
            >
              {expanded ? <ChevronUpIcon className="action-icon" /> : <ChevronDownIcon className="action-icon" />}
              {expanded ? 'Liste einklappen' : 'Liste aufklappen'}
            </button>
          </div>
          {expanded ? (
            <>
              <div className="shopping-list-groups">
                {groupedItems.map((group) => (
                  <section key={group.title} className="shopping-list-group">
                    <div className="shopping-list-group-head">
                      <h3>{group.title}</h3>
                      <span>{group.items.length} Position{group.items.length > 1 ? 'en' : ''}</span>
                    </div>
                    <ul className="list ingredient-list shopping-list-items">
                      {group.items.map((item, index) => (
                        <li key={`${group.title}-${item.name}-${index}`} className="ingredient-row shopping-list-row">
                          <span className={`shopping-item-check${item.checked ? ' shopping-item-check-done' : ''}`} aria-hidden="true" />
                          <span className="ingredient-amount">{item.amount ? `${item.amount}${item.unit ? ` ${item.unit}` : ''}` : 'offen'}</span>
                          <div className="ingredient-copy">
                            <strong>{item.name}</strong>
                            {item.note ? <span>{item.note}</span> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <div className="allergy-warning shopping-list-warning" role="note">
                <div className="allergy-warning-title">
                  <ShieldIcon className="pill-icon" />
                  <strong>Vor dem Einkauf prüfen</strong>
                </div>
                <p>
                  Mengen und Zutaten stammen aus dem Wochenplan. Bei Allergien, Unverträglichkeiten und Markenprodukten
                  bitte jede Position noch einmal manuell bestätigen.
                </p>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function flattenShoppingList(shoppingList?: ShoppingList | null): ShoppingListItem[] {
  if (!shoppingList) return [];
  if (Array.isArray(shoppingList)) return shoppingList;
  if (shoppingList.sections?.length) {
    return shoppingList.sections.flatMap((section) => section.items);
  }
  return shoppingList.items ?? [];
}

function uniqueCategories(items: ShoppingListItem[]) {
  return Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
}

function groupByCategory(items: ShoppingListItem[]) {
  const groups = new Map<string, ShoppingListItem[]>();
  for (const item of items) {
    const title = item.category?.trim() || 'Alles weitere';
    groups.set(title, [...(groups.get(title) ?? []), item]);
  }
  return Array.from(groups.entries()).map(([title, groupItems]) => ({ title, items: groupItems }));
}
