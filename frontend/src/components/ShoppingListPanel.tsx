import { useMemo, useState } from 'react';
import { getBringExportUrl } from '../api';
import type { ShoppingList, ShoppingListItem } from '../types';

interface ShoppingListPanelProps {
  planId?: string;
  shoppingList?: ShoppingList | null;
  loading: boolean;
}

export function ShoppingListPanel({ planId, shoppingList, loading }: ShoppingListPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [bringState, setBringState] = useState<'idle' | 'opening' | 'failed'>('idle');
  const items = useMemo(() => flattenShoppingList(shoppingList), [shoppingList]);
  const categories = useMemo(() => uniqueCategories(items), [items]);
  const canExport = Boolean(planId && items.length > 0);

  const openBringExport = async () => {
    if (!planId) return;
    setBringState('opening');
    try {
      const response = await getBringExportUrl(planId);
      if (!response?.url) throw new Error('missing bring export url');
      window.open(response.url, '_blank', 'noopener,noreferrer');
      setBringState('idle');
    } catch {
      setBringState('failed');
    }
  };

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
              : 'Zusammenstellung für den aktuellen Plan.'}
          </p>
        </div>
        {canExport ? (
          <div className="surface-actions">
            <button type="button" className="button button-secondary bring-export-button" onClick={copyList}>
              {copyState === 'copied' ? 'Kopiert' : 'Liste kopieren'}
            </button>
            <button
              type="button"
              className="button button-primary bring-export-button"
              onClick={openBringExport}
              disabled={bringState === 'opening'}
            >
              {bringState === 'opening' ? 'Öffnet ...' : 'Zu Bring'}
            </button>
          </div>
        ) : null}
      </div>
      {bringState === 'failed' ? (
        <p className="panel-feedback" role="alert">
          Bring-Link gerade nicht verfügbar. Kopiere die Liste als Fallback.
        </p>
      ) : null}
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
        <div className="stack">
          {Array.isArray(shoppingList) ? (
            <ul className="list">
              {shoppingList.map((item) => (
                <li key={`${item.category}-${item.name}`}>
                  <strong>{item.name}</strong>
                  {formatAmount(item)}
                  {item.category ? ` · ${item.category}` : ''}
                </li>
              ))}
            </ul>
          ) : shoppingList.summary ? (
            <p className="inspector-copy">{shoppingList.summary}</p>
          ) : null}
          {!Array.isArray(shoppingList) && (shoppingList.sections ?? []).length > 0 ? (
            shoppingList.sections?.map((section) => (
              <div key={section.title}>
                <h3>{section.title}</h3>
                <ul className="list">
                  {section.items.map((item) => (
                    <li key={`${section.title}-${item.name}`}>
                      <strong>{item.name}</strong>
                      {formatAmount(item)}
                      {item.category ? ` · ${item.category}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : !Array.isArray(shoppingList) ? (
            <ul className="list">
              {shoppingList.items?.map((item) => (
                <li key={item.name}>
                  <strong>{item.name}</strong>
                  {formatAmount(item)}
                </li>
              ))}
            </ul>
          ) : null}
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
