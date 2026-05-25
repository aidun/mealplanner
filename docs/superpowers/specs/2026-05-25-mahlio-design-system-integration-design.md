# Design-Spec: Mahlio Design System Integration

**Datum:** 2026-05-25
**Branch:** `fix/api-image-pull-policy` → neuer Branch `feat/mahlio-design-system`
**Scope:** CSS-Token-Konsolidierung, Komponenten-CSS-Erweiterung, React-Komponenten-Anpassung

---

## Hintergrund

Das Mahlio Design System wurde via `claude.ai/design` aus dem bestehenden Codebase (`aidun/mealplanner`) reverse-engineered und als kanonische Designreferenz exportiert. Es definiert:

- Eine vollständige Token-Hierarchie (`colors_and_type.css`)
- UI-Kit-Komponenten als React-Prototypen (`ui_kits/web/`)
- Canonical-Palette: Sage-Grün `#1a8a63`, Creme-Basis `#fbf6ed`

**Problem:** `frontend/src/styles.css` (7148 Zeilen) enthält drei konflikierende `:root`-Blöcke aus Design-Iterationen:
1. Zeilen 3–42: Original (sage `#1a8a63`) — entspricht dem Design System
2. Zeilen 4468+: "Redesign Draft 2026-04-23" (olive `#556b2f`) — abweichende Palette
3. Zeilen 5975+: "Pitch UI Sprint 2026-04-27" (dunkleres olive `#526442`) — weitere Abweichung

Da CSS-Kaskade gilt, gewinnen immer die späteren Blöcke. Der aktuelle Produktionsstand weicht damit vom Design System ab.

---

## Ziel

Einen einzigen, kanonischen `:root`-Block mit allen Design-System-Tokens, konsistente Komponentenklassen und aktualisierte React-Komponenten.

---

## Abschnitt 1: Token-Konsolidierung (`styles.css`)

### Aktion
- Den ersten `:root`-Block (Zeilen 3–42) zur kanonischen Quelle machen und alle fehlenden Tokens ergänzen.
- Die nachfolgenden Redesign-Draft- und Pitch-UI-Blöcke (ab Zeile 4468 und 5975) entfernen — sie widersprechen dem Design System und wurden als temporäre Iterationen angelegt.

### Hinzuzufügende Tokens (fehlen im aktuellen ersten `:root`)

**Markenpalette (named swatches):**
```css
--mahlio-sage: #2e6b4e;
--mahlio-sage-deep: #14684c;
--mahlio-mint: #dbe6d2;
--mahlio-cream: #fbf6ed;
--mahlio-cream-warm: #f8f1e8;
--mahlio-tomato: #e35a45;
--mahlio-tomato-deep: #b9311b;
--mahlio-lemon: #f2c94c;
--mahlio-lemon-soft: #f2c76e;
--mahlio-herb-ink: #1f2a24;
--mahlio-olive: #556b2f;
```

**Font-Variablen:**
```css
--font-body: "Plus Jakarta Sans", "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
```
Außerdem `font-family: var(--font-body)` auf `:root` setzen (statt hardcoded "Avenir Next").

**Fehlende Semantic-Tokens:**
```css
--surface-solid: #fffdf7;
--on-dark: #fffaf5;
--on-dark-soft: rgba(255, 250, 245, 0.72);
--success-bg: #e9fff7;
--success-fg: #14684c;
--error-bg: #fff1ed;
--error-fg: #b42318;
--ink-night: #111f1a;
--ink-night-soft: #1b4838;
--bg-page-grad: (die radial-gradient-Kette als Variable)
```

**Erweitertes Shadow-System (6 Stufen):**
```css
--shadow-rest:   0 12px 26px rgba(18, 33, 29, 0.05);
--shadow-soft:   0 14px 30px rgba(18, 33, 29, 0.05);
--shadow-card:   0 18px 46px rgba(18, 33, 29, 0.06);
--shadow-hero:   0 30px 72px rgba(18, 33, 29, 0.09);
--shadow-button: 0 12px 26px rgba(15, 118, 110, 0.18);
/* --shadow und --shadow-strong bleiben erhalten */
```

**Erweitertes Radius-System:**
```css
--radius-xs:   6px;
--radius-xl:   36px;
--radius-pill: 999px;
/* --radius-sm, --radius-md, --radius-lg bleiben erhalten */
```

**Spacing-Skala (4px-Basis):**
```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px;
--space-4: 16px; --space-5: 20px; --space-6: 24px;
--space-7: 32px; --space-8: 40px; --space-9: 56px;
```

**Type-Skala:**
```css
--fs-display-hero: clamp(3.9rem, 12vw, 7rem);
--fs-display-1:    clamp(2.5rem, 6vw, 4rem);
--fs-display-2:    clamp(2.1rem, 5vw, 3.2rem);
--fs-h1:           clamp(1.8rem, 3vw, 2.4rem);
--fs-h2:           1.4rem;
--fs-h3:           1.1rem;
--fs-body:         1rem;
--fs-small:        0.92rem;
--fs-caption:      0.82rem;
--fs-eyebrow:      0.76rem;
```

**Line-Height-Skala:**
```css
--lh-tight:   0.92;
--lh-display: 1.05;
--lh-body:    1.5;
--lh-reading: 1.62;
```

**Motion-Variablen:**
```css
--ease-out:    cubic-bezier(.2,.7,.2,1);
--dur-instant: 120ms;
--dur-fast:    160ms;
--dur-base:    220ms;
--dur-rise:    420ms;
```

### Nicht ändern
- `--accent: #1a8a63`, `--accent-strong: #14684c` — entsprechen bereits dem Design System
- `--tomato: #df6a46`, `--lemon: #f2c76e` — korrekt
- `--bg: #f8f1e8` — bleibt erhalten
- `--page-max`, `--header-offset` — bleiben

---

## Abschnitt 2: Komponenten-CSS

Fehlende Design-System-Klassen werden ans Ende von `styles.css` angefügt (eigener, kommentierter Block). Bestehende Klassen werden **nicht** entfernt.

### Hinzuzufügen

**Button-System (`.btn-*`):**
- `.btn` — Basis: flex, min-height 44px, border-radius 8px, transition
- `.btn-primary` — sage-Gradient, shadow-button
- `.btn-secondary` — gläsern, tonal border
- `.btn-tomato` — tomato-Gradient
- `.btn-ghost` — transparent, accent-Textfarbe
- `.btn-compact` — min-height 36px, kleinere Schrift
- `.icon-btn` — 44×44px quadratisch

**Surface-System:**
- `.surface` — Glasmorphism-Card (border, border-radius md, shadow-card, backdrop-blur)
- `.surface-header` — flex header innerhalb surface

**Editorial-Typografie:**
- `.eyebrow` — uppercase, accent-Farbe, letter-spacing
- `.lead` — ink-soft, leicht größere Schrift, reading line-height

**Plan-Stage:**
- `.plan-stage` — Hero-Bereich mit lemon-Radial-Gradient, shadow-hero
- `.plan-stage-head` — 2-spaltiges Grid
- `.plan-stage-facts` — 3-spaltiges Stat-Grid
- `.stage-stat` — einzelne Stat-Karte

---

## Abschnitt 3: React-Komponenten

Nur Klassen-Namen und kleinere visuelle Anpassungen — keine Logik-Änderungen.

| Komponente | Änderung |
|---|---|
| `Header.tsx` | Sticky-Header-Klassen auf `.app-header`, `.brand-mark`, `.week-chip` prüfen/anpassen |
| `LoginPage.tsx` | `.auth-shell`, `.login-panel` Klassen-Konsistenz mit Design System sicherstellen |
| `MealBoard.tsx` | `.day-tab-active`, `.meal-row-active` Klassen prüfen |
| `MealInspector.tsx` | `.inspector-hero`, `.ingredient-row`, `.step-list` Klassen prüfen |
| `ShoppingListPanel.tsx` | `.shopping-item`, `.check-box` Klassen prüfen |
| `DashboardPage.tsx` | `.plan-stage` und `.eyebrow` integrieren |

---

## Datei-Scope

| Datei | Art der Änderung |
|---|---|
| `frontend/src/styles.css` | Token-Konsolidierung (`:root` merge) + Komponenten-CSS ergänzen |
| `frontend/src/pages/LoginPage.tsx` | Klassen-Anpassung |
| `frontend/src/pages/DashboardPage.tsx` | Klassen-Anpassung + `.plan-stage` |
| `frontend/src/components/Header.tsx` | Klassen-Anpassung |
| `frontend/src/components/MealBoard.tsx` | Klassen-Anpassung |
| `frontend/src/components/MealInspector.tsx` | Klassen-Anpassung |
| `frontend/src/components/ShoppingListPanel.tsx` | Klassen-Anpassung |

---

## Was explizit NICHT geändert wird

- Funktionale Logik, State-Management, API-Calls
- TypeScript-Typen
- Test-Dateien
- Kubernetes/Deploy-Manifeste
- Backend-Code

---

## Erfolgskriterien

1. `styles.css` hat genau einen `:root`-Block mit allen Design-System-Tokens
2. `font-family: "Plus Jakarta Sans"` ist der aktive Body-Font
3. Alle neuen Token-Namen (`--shadow-card`, `--radius-pill`, `--space-*`, `--fs-*`, `--dur-*`) sind verfügbar
4. Die App rendert visuell korrekt (kein Build-Fehler, keine FOUC)
5. `npm run build` im frontend läuft fehlerlos durch
