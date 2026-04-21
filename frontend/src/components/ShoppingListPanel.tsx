import { useMemo, useState } from 'react';
import { BringLink } from './BringLink';
import type { ShoppingList, ShoppingListItem } from '../types';
import { ShieldIcon } from './icons';

interface ShoppingListPanelProps {
  planId?: string;
  shoppingList?: ShoppingList | null;
  loading: boolean;
}

export function ShoppingListPanel({ planId, shoppingList, loading }: ShoppingListPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const items = useMemo(() => flattenShoppingList(shoppingList), [shoppingList]);
  const categories = useMemo(() => uniqueCategories(items), [items]);
  const groupedItems = useMemo(() => groupByCategory(items), [items]);
  const prominentCategories = categories.slice(0, 3);
  const summary = !Array.isArray(shoppingList) ? shoppingList?.summary : undefined;
  const canExport = Boolean(planId && items.length > 0);

  const copyList = async () => {
    if (items.length === 0) return;
    try {
      await writeClipboard(items.map(formatLine).join('\n'));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <section className="surface shopping-list-panel">
      <div className="surface-header">
        <div>
          <h2>Einkaufsliste</h2>
          <p>
            {items.length > 0
              ? `${items.length} Artikel${categories.length > 0 ? ` · ${categories.length} Bereiche` : ''}`
              : 'Alles für den aktuellen Plan an einem Ort.'}
          </p>
        </div>
        {canExport ? (
          <div className="surface-actions">
            <button type="button" className="button button-secondary bring-export-button" onClick={copyList}>
              {copyState === 'copied' ? 'Kopiert' : 'Liste kopieren'}
            </button>
            <BringLink planId={planId} label="Woche zu Bring" />
          </div>
        ) : null}
      </div>
      {copyState === 'failed' ? (
        <p className="panel-feedback" role="alert">
          Kopieren nicht möglich. Markiere die Liste manuell.
        </p>
      ) : null}

      {loading ? <p className="muted">Lädt ...</p> : null}

      {!loading && !shoppingList ? (
        <div className="empty-state compact">
          <h3>Keine Liste verfügbar</h3>
          <p>Die Einkaufsliste erscheint, sobald ein Plan vorhanden ist.</p>
        </div>
      ) : null}

      {shoppingList ? (
        <div className="stack shopping-list-stack">
          {summary ? <p className="inspector-copy">{summary}</p> : null}
          {prominentCategories.length > 0 ? (
            <div className="shopping-category-row" aria-label="Schnelle Bereiche">
              {prominentCategories.map((category) => (
                <span key={category} className="shopping-category-pill">
                  {category}
                </span>
              ))}
            </div>
          ) : null}
          <div className="shopping-list-groups">
            {groupedItems.map((group) => (
              <section key={group.title} className="shopping-list-group">
                <h3>{group.title}</h3>
                <ul className="list ingredient-list shopping-list-items">
                  {group.items.map((item, index) => (
                    <li key={`${group.title}-${item.name}-${index}`} className="ingredient-row shopping-list-row">
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
              <strong>Vor dem Einkauf pruefen</strong>
            </div>
            <p>
              Mengen und Zutaten stammen aus dem Wochenplan. Bei Allergien, Unvertraeglichkeiten und Markenprodukten
              bitte jede Position noch einmal manuell bestaetigen.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatAmount(item: ShoppingListItem) {
  if (!item.amount) return '';
  return ` · ${item.amount}${item.unit ? ` ${item.unit}` : ''}`;
}

function formatLine(item: ShoppingListItem) {
  return `${item.name}${formatAmount(item).replace(' · ', ' ')}`.trim();
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

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) {
    throw new Error('copy failed');
  }
}
