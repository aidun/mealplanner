package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/aidun/mealplanner/backend/api/internal/store"
)

type bringExportView struct {
	Title        string
	WeekStart    string
	Description  string
	CanonicalURL string
	Items        []bringExportItem
	Ingredients  []string
	SchemaJSON   template.JS
}

type bringExportItem struct {
	Name     string
	Amount   string
	Unit     string
	Category string
	Line     string
}

func (h *Handler) getBringExportURL(w http.ResponseWriter, r *http.Request) {
	planID := r.PathValue("planID")
	if _, err := h.repo.GetPlan(r, planID); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "plan not found")
		return
	} else if err != nil {
		h.serverError(w, err)
		return
	}
	token, ok := h.signBringExport(planID)
	if !ok {
		writeError(w, http.StatusServiceUnavailable, "bring export is not configured")
		return
	}
	exportURL := h.absoluteRequestURL(r, "/api/plans/"+url.PathEscape(planID)+"/bring-export")
	query := exportURL.Query()
	query.Set("token", token)
	exportURL.RawQuery = query.Encode()
	writeJSON(w, http.StatusOK, map[string]string{"url": exportURL.String()})
}

func (h *Handler) getBringExport(w http.ResponseWriter, r *http.Request) {
	planID := r.PathValue("planID")
	plan, err := h.planForBringExport(r, planID)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "plan not found")
		return
	}
	if err != nil {
		h.serverError(w, err)
		return
	}

	canonicalURL := h.absoluteRequestURL(r, "/api/plans/"+url.PathEscape(planID)+"/bring-export")
	canonicalURL.RawQuery = r.URL.RawQuery
	view, err := newBringExportView(plan, canonicalURL.String())
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

func (h *Handler) planForBringExport(r *http.Request, planID string) (domain.Plan, error) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token != "" {
		if !h.verifyBringExport(planID, token) {
			return domain.Plan{}, store.ErrNotFound
		}
		return h.repo.GetPlanByID(r, planID)
	}

	userID, _, _, ok := h.readSession(r)
	if !ok {
		return domain.Plan{}, store.ErrNotFound
	}
	return h.repo.GetPlan(withUserID(r, userID), planID)
}

func (h *Handler) signBringExport(planID string) (string, bool) {
	if !configuredSecret(h.apiSecret) {
		return "", false
	}
	mac := hmac.New(sha256.New, []byte(h.apiSecret))
	mac.Write([]byte("bring-export:"))
	mac.Write([]byte(planID))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), true
}

func (h *Handler) verifyBringExport(planID string, token string) bool {
	expected, ok := h.signBringExport(planID)
	if !ok {
		return false
	}
	expectedBytes, err := base64.RawURLEncoding.DecodeString(expected)
	if err != nil {
		return false
	}
	tokenBytes, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return false
	}
	return hmac.Equal(tokenBytes, expectedBytes)
}

func (h *Handler) absoluteRequestURL(r *http.Request, path string) *url.URL {
	if baseURL := h.auth.BaseURL(); baseURL != "" {
		parsed, err := url.Parse(baseURL)
		if err == nil && parsed.Scheme != "" && parsed.Host != "" {
			return &url.URL{Scheme: parsed.Scheme, Host: parsed.Host, Path: path}
		}
	}
	scheme := firstForwardedValue(r.Header.Get("X-Forwarded-Proto"))
	if scheme == "" {
		if r.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}
	host := firstForwardedValue(r.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = r.Host
	}
	return &url.URL{Scheme: scheme, Host: host, Path: path}
}

func firstForwardedValue(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	parts := strings.Split(value, ",")
	return strings.TrimSpace(parts[0])
}

func newBringExportView(plan domain.Plan, canonicalURL string) (bringExportView, error) {
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
	description := "Ein vorbereitetes Wochenrezept fuer die Familienkueche mit allen Zutaten aus dem aktuellen Mealplanner-Wochenplan."
	schema := map[string]any{
		"@context":         "https://schema.org",
		"@type":            "Recipe",
		"author":           "Mealplanner",
		"cookTime":         "PT0M",
		"description":      description,
		"keywords":         "Wochenplan, Einkaufsliste, Familienkueche",
		"name":             title,
		"prepTime":         "PT10M",
		"recipeCategory":   "Wochenplan",
		"recipeCuisine":    "Familienkueche",
		"recipeYield":      "1 Wochenplan",
		"recipeIngredient": ingredients,
		"recipeInstructions": []map[string]string{{
			"@type": "HowToStep",
			"text":  "Alle Zutaten in Bring uebernehmen und fuer die Woche einkaufen.",
		}},
		"totalTime": "PT10M",
	}
	if strings.TrimSpace(canonicalURL) != "" {
		schema["url"] = strings.TrimSpace(canonicalURL)
		schema["mainEntityOfPage"] = map[string]string{"@type": "WebPage", "@id": strings.TrimSpace(canonicalURL)}
	}
	if strings.TrimSpace(plan.WeekStart) != "" {
		schema["datePublished"] = strings.TrimSpace(plan.WeekStart)
	}
	rawSchema, err := json.Marshal(schema)
	if err != nil {
		return bringExportView{}, err
	}

	return bringExportView{
		Title:        title,
		WeekStart:    strings.TrimSpace(plan.WeekStart),
		Description:  description,
		CanonicalURL: strings.TrimSpace(canonicalURL),
		Items:        items,
		Ingredients:  ingredients,
		// #nosec G203 -- rawSchema is produced by json.Marshal before template execution.
		SchemaJSON: template.JS(rawSchema),
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
  {{ if .CanonicalURL }}<link rel="canonical" href="{{ .CanonicalURL }}">{{ end }}
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
    .instruction {
      margin: 0 0 18px;
      padding: 14px 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
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
  <main itemscope itemtype="https://schema.org/Recipe">
    <p class="eyebrow">Bring Import</p>
    <h1 itemprop="name">{{ .Title }}</h1>
    <meta itemprop="author" content="Mealplanner">
    {{ if .CanonicalURL }}<meta itemprop="url" content="{{ .CanonicalURL }}">{{ end }}
    <meta itemprop="recipeYield" content="1 Wochenplan">
    <meta itemprop="prepTime" content="PT10M">
    <meta itemprop="cookTime" content="PT0M">
    <meta itemprop="totalTime" content="PT10M">
    <meta itemprop="recipeCategory" content="Wochenplan">
    <meta itemprop="recipeCuisine" content="Familienkueche">
    {{ if .WeekStart }}<meta itemprop="datePublished" content="{{ .WeekStart }}">{{ end }}
    <p class="lead" itemprop="description">{{ .Description }}</p>
    <section class="bring-box" aria-label="Bring Import">
      <div data-bring-import="" style="display:none"></div>
      <a href="https://www.getbring.com">Bring! Einkaufsliste App fuer iPhone und Android</a>
      <p>Falls Bring die Rezeptdaten nicht automatisch uebernimmt, kopiere die Liste direkt aus der Mealplanner-App.</p>
    </section>
    <div class="instruction" itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep">
      <meta itemprop="position" content="1">
      <span itemprop="text">Alle Zutaten in Bring uebernehmen und fuer die Woche einkaufen.</span>
    </div>
    {{ if .Items }}
      <ul>
        {{ range .Items }}
          <li>
            <strong itemprop="recipeIngredient">{{ .Line }}</strong>
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
