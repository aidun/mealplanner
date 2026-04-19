package httpapi

import (
	"encoding/json"
	"fmt"
	"html/template"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/aidun/mealplanner/backend/api/internal/store"
)

type bringExportView struct {
	Title       string
	WeekStart   string
	Items       []bringExportItem
	Ingredients []string
	SchemaJSON  template.JS
}

type bringExportItem struct {
	Name     string
	Amount   string
	Unit     string
	Category string
	Line     string
}

func (h *Handler) getBringExport(w http.ResponseWriter, r *http.Request) {
	plan, err := h.repo.GetPlan(r, r.PathValue("planID"))
	if err == store.ErrNotFound {
		writeError(w, http.StatusNotFound, "plan not found")
		return
	}
	if err != nil {
		h.serverError(w, err)
		return
	}

	view, err := newBringExportView(plan)
	if err != nil {
		h.serverError(w, err)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	if err := bringExportTemplate.Execute(w, view); err != nil {
		h.logger.Error("bring export render error", "error", err)
	}
}

func newBringExportView(plan domain.Plan) (bringExportView, error) {
	shoppingItems := domain.ConsolidateShoppingList(plan)
	items := make([]bringExportItem, 0, len(shoppingItems))
	ingredients := make([]string, 0, len(shoppingItems))
	for _, item := range shoppingItems {
		line := formatBringIngredient(item)
		if line == "" {
			continue
		}
		items = append(items, bringExportItem{
			Name:     strings.TrimSpace(item.Name),
			Amount:   formatAmountValue(item.Amount),
			Unit:     strings.TrimSpace(item.Unit),
			Category: strings.TrimSpace(item.Category),
			Line:     line,
		})
		ingredients = append(ingredients, line)
	}

	title := "Mealplanner Einkaufsliste"
	if strings.TrimSpace(plan.WeekStart) != "" {
		title = fmt.Sprintf("Mealplanner Einkaufsliste ab %s", strings.TrimSpace(plan.WeekStart))
	}
	schema := map[string]any{
		"@context":         "https://schema.org",
		"@type":            "Recipe",
		"author":           map[string]string{"@type": "Person", "name": "Mealplanner"},
		"description":      "Konsolidierte Einkaufsliste aus dem Mealplanner Wochenplan.",
		"image":            "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
		"name":             title,
		"recipeYield":      "1 Wochenplan",
		"recipeIngredient": ingredients,
		"recipeInstructions": []map[string]string{{
			"@type": "HowToStep",
			"text":  "Alle Zutaten zur Einkaufsliste hinzufuegen.",
		}},
	}
	rawSchema, err := json.Marshal(schema)
	if err != nil {
		return bringExportView{}, err
	}

	return bringExportView{
		Title:       title,
		WeekStart:   strings.TrimSpace(plan.WeekStart),
		Items:       items,
		Ingredients: ingredients,
		SchemaJSON:  template.JS(rawSchema),
	}, nil
}

func formatBringIngredient(item domain.ShoppingItem) string {
	name := strings.TrimSpace(item.Name)
	if name == "" {
		return ""
	}
	amount := formatAmountValue(item.Amount)
	unit := strings.TrimSpace(item.Unit)
	parts := make([]string, 0, 3)
	if amount != "" {
		parts = append(parts, amount)
	}
	if unit != "" {
		parts = append(parts, unit)
	}
	parts = append(parts, name)
	return strings.Join(parts, " ")
}

func formatAmountValue(amount float64) string {
	if amount == 0 {
		return ""
	}
	if math.Abs(amount-math.Round(amount)) < 0.0001 {
		return strconv.FormatInt(int64(math.Round(amount)), 10)
	}
	return strconv.FormatFloat(amount, 'f', -1, 64)
}

var bringExportTemplate = template.Must(template.New("bring-export").Parse(`<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ .Title }}</title>
  <script type="application/ld+json">{{ .SchemaJSON }}</script>
  <script async="async" src="https://platform.getbring.com/widgets/import.js"></script>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #12211d;
      background: #f6fbf8;
      --line: #c9ddd5;
      --muted: #5c756d;
      --accent: #0f766e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-width: 0;
      background: #f6fbf8;
    }
    main {
      width: min(760px, 100%);
      margin: 0 auto;
      padding: 28px 18px 40px;
    }
    .eyebrow {
      margin: 0 0 8px;
      color: var(--accent);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: clamp(2rem, 9vw, 4rem);
      line-height: 0.96;
      letter-spacing: 0;
    }
    .lead {
      margin: 14px 0 26px;
      color: var(--muted);
      font-size: 1.05rem;
    }
    .bring-box {
      display: grid;
      gap: 10px;
      margin: 0 0 24px;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #ffffff;
    }
    .bring-box p {
      margin: 0;
      color: var(--muted);
    }
    ul {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: grid;
      gap: 3px;
      padding: 13px 0;
      border-top: 1px solid var(--line);
    }
    li:last-child { border-bottom: 1px solid var(--line); }
    strong {
      font-size: 1.05rem;
    }
    span {
      color: var(--muted);
    }
    .empty {
      margin-top: 24px;
      padding: 18px 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Bring Import</p>
    <h1>{{ .Title }}</h1>
    <p class="lead">Diese Seite enthaelt die Zutaten als Rezeptdaten, Bring-Import und als lesbare Einkaufsliste.</p>
    <section class="bring-box" aria-label="Bring Import">
      <div data-bring-import="" style="display:none"></div>
      <a href="https://www.getbring.com">Bring! Einkaufsliste App fuer iPhone und Android</a>
      <p>Wenn Bring die lokale Test-URL nicht importiert, kopiere die Liste aus der Mealplanner-App und fuege sie in Bring ein.</p>
    </section>
    {{ if .Items }}
      <ul>
        {{ range .Items }}
          <li>
            <strong>{{ .Line }}</strong>
            {{ if .Category }}<span>{{ .Category }}</span>{{ end }}
          </li>
        {{ end }}
      </ul>
    {{ else }}
      <p class="empty">Keine Zutaten in diesem Wochenplan gefunden.</p>
    {{ end }}
  </main>
</body>
</html>`))
