import { useEffect, useMemo, useState } from 'react';
import { BringLink } from './BringLink';
import type { ShoppingList, ShoppingListItem } from '../types';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from './icons';

interface ShoppingListPanelProps {
  planId?: string;
  shoppingList?: ShoppingList | null;
  loading: boolean;
}

export function ShoppingListPanel({ planId, shoppingList, loading }: ShoppingListPanelProps) {
  // Checked items stay local per plan and are excluded from generated Bring links.
  const [expanded, setExpanded] = useState(true);
  const items = useMemo(() => flattenShoppingList(shoppingList), [shoppingList]);
  const itemKeySignature = useMemo(() => items.map(shoppingItemKey).join('|'), [items]);
  const storageKey = planId ? `mealplanner.shopping.checked.${planId}` : '';
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  useEffect(() => {
    const checkedFromPlan = items.filter((item) => item.checked).map(shoppingItemKey);
    if (!storageKey) {
      setCheckedKeys(checkedFromPlan);
      return;
    }
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
      const storedKeys = Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : [];
      const available = new Set(items.map(shoppingItemKey));
      setCheckedKeys([...new Set([...checkedFromPlan, ...storedKeys.filter((key) => available.has(key))])]);
    } catch {
      setCheckedKeys(checkedFromPlan);
    }
  }, [itemKeySignature, storageKey]);
  const categories = useMemo(() => uniqueCategories(items), [items]);
  const groupedItems = useMemo(() => groupByCategory(items), [items]);
  const sectionTitles = useMemo(() => sectionPreviewTitles(shoppingList), [shoppingList]);
  const summary = !Array.isArray(shoppingList) ? shoppingList?.summary : undefined;
  const checkedKeySet = useMemo(() => new Set(checkedKeys), [checkedKeys]);
  const checkedItems = items.filter((item) => checkedKeySet.has(shoppingItemKey(item))).length;
  const remainingItems = Math.max(0, items.length - checkedItems);
  const excludedItems = items.filter((item) => checkedKeySet.has(shoppingItemKey(item))).map((item) => item.name);
  const canExport = Boolean(planId && items.length > 0);
  const progress = items.length > 0 ? Math.round((checkedItems / items.length) * 100) : 0;

  const toggleItem = (item: ShoppingListItem) => {
    const key = shoppingItemKey(item);
    setCheckedKeys((current) => {
      const next = current.includes(key) ? current.filter((value) => value !== key) : [...current, key];
      if (storageKey) {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return next;
    });
  };

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
            <BringLink planId={planId} label="Woche zu Bring" scope={{ exclude: excludedItems }} disabled={remainingItems === 0} />
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
            {sectionTitles.length > 0 ? (
              <div className="shopping-preview-pills" aria-label="Bezug zur Woche">
                {sectionTitles.map((title) => (
                  <span key={title} className="shopping-category-pill">
                    {title}
                  </span>
                ))}
              </div>
            ) : null}
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
            <div className="shopping-list-groups">
              {groupedItems.map((group) => (
                <section key={group.title} className="shopping-list-group">
                  <div className="shopping-list-group-head">
                    <h3>{group.title}</h3>
                    <span>{group.items.length} Position{group.items.length > 1 ? 'en' : ''}</span>
                  </div>
                  <ul className="list ingredient-list shopping-list-items">
                    {group.items.map((item, index) => {
                      const checked = checkedKeySet.has(shoppingItemKey(item));
                      return (
                        <li
                          key={`${group.title}-${item.name}-${index}`}
                          className={`ingredient-row shopping-list-row${checked ? ' shopping-list-row-done' : ''}`}
                        >
                          <button
                            type="button"
                            className={`shopping-item-check${checked ? ' shopping-item-check-done' : ''}`}
                            aria-pressed={checked}
                            aria-label={checked ? `${item.name} wieder öffnen` : `${item.name} abhaken`}
                            onClick={() => toggleItem(item)}
                          >
                            {checked ? <CheckIcon className="shopping-item-check-icon" /> : null}
                          </button>
                          <span className="shopping-category-icon" aria-hidden="true">
                            <CategoryIcon category={item.category} />
                          </span>
                          <span className="ingredient-amount">{item.amount ? `${item.amount}${item.unit ? ` ${item.unit}` : ''}` : 'offen'}</span>
                          <div className="ingredient-copy">
                            <strong>{item.name}</strong>
                            {item.note ? <span>{item.note}</span> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function shoppingItemKey(item: ShoppingListItem) {
  return [item.name, item.unit ?? '', item.category ?? '']
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
}

function CategoryIcon({ category }: { category?: string }) {
  const value = (category ?? '').toLowerCase();
  if (value.includes('gemüse') || value.includes('obst')) {
    return (
      <svg viewBox="0 0 24 24" className="shopping-category-svg">
        <path d="M5 13c6-7 11-8 15-8-1 7-4 12-11 14-2 .6-4-.4-4-2.4V13Z" />
        <path d="M7 16c3-4 6-6 10-8" />
      </svg>
    );
  }
  if (value.includes('kühl') || value.includes('milch')) {
    return (
      <svg viewBox="0 0 24 24" className="shopping-category-svg">
        <path d="M8 3h8l-1 5 2 3v9H7v-9l2-3-1-5Z" />
        <path d="M8 12h8" />
      </svg>
    );
  }
  if (value.includes('fleisch') || value.includes('fisch')) {
    return (
      <svg viewBox="0 0 24 24" className="shopping-category-svg">
        <path d="M4 12c4-5 9-6 14-2l2-2v8l-2-2c-5 4-10 3-14-2Z" />
        <path d="M8 12h.01" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="shopping-category-svg">
      <path d="M6 9h12l-1 11H7L6 9Z" />
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function flattenShoppingList(shoppingList?: ShoppingList | null): ShoppingListItem[] {
  // Support both backend list shapes while the UI is migrating to sectioned shopping documents.
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

function sectionPreviewTitles(shoppingList?: ShoppingList | null) {
  if (!shoppingList || Array.isArray(shoppingList) || !shoppingList.sections?.length) {
    return [];
  }
  return shoppingList.sections
    .map((section) => section.title?.trim())
    .filter((title): title is string => Boolean(title))
    .slice(0, 4);
}
