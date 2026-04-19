import type { ShoppingList, ShoppingListItem } from '../types';

interface ShoppingListPanelProps {
  shoppingList?: ShoppingList | null;
  loading: boolean;
}

export function ShoppingListPanel({ shoppingList, loading }: ShoppingListPanelProps) {
  return (
    <section className="surface">
      <div className="surface-header">
        <div>
          <h2>Einkaufsliste</h2>
          <p>Zusammenstellung für den aktuellen Plan.</p>
        </div>
      </div>

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
