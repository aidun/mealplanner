# Mahlio Design System Integration – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen einzigen, kanonischen `:root`-Block mit allen Mahlio-Design-System-Tokens etablieren, die drei konfliktierenden `:root`-Blöcke konsolidieren und fehlende Komponenten-CSS-Klassen ergänzen.

**Architecture:** Die `frontend/src/styles.css` (7148 Zeilen) hat drei aufeinander gestapelte `:root`-Blöcke aus Design-Iterationen. Da die Kaskade gilt, gewinnt immer der letzte — was von der Design-System-Palette abweicht. Wir aktualisieren den ersten `:root`-Block zum kanonischen Stand (sage `#1a8a63`, Creme-Basis), entfernen die `:root`-Overrides aus den späteren Abschnitten und ergänzen fehlende Tokens.

**Tech Stack:** CSS Custom Properties, React 18 + TypeScript, Vite

---

## Datei-Scope

| Datei | Art der Änderung |
|---|---|
| `frontend/src/styles.css` | `:root` konsolidieren, Tokens ergänzen, Komponenten-CSS hinzufügen |

*Keine TSX-Dateien werden geändert — die bestehenden Klassen (`.button-primary`, `.eyebrow`, `.plan-stage` etc.) stimmen bereits mit dem Design System überein.*

---

## Task 1: Fonts und Basis-Variablen im ersten `:root` korrigieren

**Files:**
- Modify: `frontend/src/styles.css:3-37`

*Hinweis: CSS hat keine Unit-Tests. Der "Test" ist hier: Build-Check + visuell. Der Build-Schritt kommt in Task 5.*

- [ ] **Step 1: Ersten `:root`-Block in styles.css öffnen und `font-family` korrigieren**

Den bestehenden Block (Zeilen 3–37) ändern. Die Zeile:
```css
  font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
```
ersetzen durch:
```css
  font-family: "Plus Jakarta Sans", "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
```

Gleichzeitig `--font-display` aktualisieren — die Zeile:
```css
  --font-display: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
```
ersetzen durch:
```css
  --font-display: "Newsreader", "Iowan Old Style", "Palatino Linotype", Georgia, serif;
```

- [ ] **Step 2: Neue Font-Variablen ergänzen**

Direkt nach `--font-display: ...;` einfügen:
```css
  --font-body: "Plus Jakarta Sans", "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: fonts im ersten :root auf Plus Jakarta Sans + Newsreader korrigieren"
```

---

## Task 2: Fehlende Design-Tokens zum ersten `:root` hinzufügen

**Files:**
- Modify: `frontend/src/styles.css:3-37`

- [ ] **Step 1: Named Brand-Palette ergänzen**

Am Ende des ersten `:root`-Blocks (direkt vor der schließenden `}`), nach `--header-offset` und `-webkit-tap-highlight-color`, einfügen:

```css
  /* ── Mahlio Brand-Palette ── */
  --mahlio-sage:        #2e6b4e;
  --mahlio-sage-deep:   #14684c;
  --mahlio-mint:        #dbe6d2;
  --mahlio-cream:       #fbf6ed;
  --mahlio-cream-warm:  #f8f1e8;
  --mahlio-tomato:      #e35a45;
  --mahlio-tomato-deep: #b9311b;
  --mahlio-lemon:       #f2c94c;
  --mahlio-lemon-soft:  #f2c76e;
  --mahlio-herb-ink:    #1f2a24;
  --mahlio-olive:       #556b2f;
```

- [ ] **Step 2: Fehlende Semantic-Tokens ergänzen**

Direkt nach der Brand-Palette einfügen:

```css
  /* ── Fehlende Semantic-Tokens ── */
  --surface-solid:  #fffdf7;
  --on-dark:        #fffaf5;
  --on-dark-soft:   rgba(255, 250, 245, 0.72);
  --success-bg:     #e9fff7;
  --success-fg:     #14684c;
  --error-bg:       #fff1ed;
  --error-fg:       #b42318;
  --ink-night:      #111f1a;
  --ink-night-soft: #1b4838;
```

- [ ] **Step 3: Erweitertes Shadow-System ergänzen**

Direkt nach `--on-dark-soft` einfügen:

```css
  /* ── Erweitertes Shadow-System ── */
  --shadow-rest:   0 12px 26px rgba(18, 33, 29, 0.05);
  --shadow-soft:   0 14px 30px rgba(18, 33, 29, 0.05);
  --shadow-card:   0 18px 46px rgba(18, 33, 29, 0.06);
  --shadow-hero:   0 30px 72px rgba(18, 33, 29, 0.09);
  --shadow-button: 0 12px 26px rgba(15, 118, 110, 0.18);
  /* --shadow und --shadow-strong bleiben erhalten */
```

- [ ] **Step 4: Erweiterte Radii ergänzen**

Direkt danach einfügen:

```css
  /* ── Erweiterte Radii ── */
  --radius-xs:   6px;
  --radius-xl:   36px;
  --radius-pill: 999px;
  /* --radius-sm (8px), --radius-md (20px), --radius-lg (28px) bleiben erhalten */
```

- [ ] **Step 5: Spacing-Skala ergänzen**

Direkt danach einfügen:

```css
  /* ── Spacing-Skala (4px-Basis) ── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 56px;
```

- [ ] **Step 6: Type-Skala ergänzen**

Direkt danach einfügen:

```css
  /* ── Type-Skala ── */
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

- [ ] **Step 7: Line-Height-Skala und Motion-Vars ergänzen**

Direkt danach einfügen:

```css
  /* ── Line-Height-Skala ── */
  --lh-tight:   0.92;
  --lh-display: 1.05;
  --lh-body:    1.5;
  --lh-reading: 1.62;

  /* ── Motion ── */
  --ease-out:    cubic-bezier(.2, .7, .2, 1);
  --dur-instant: 120ms;
  --dur-fast:    160ms;
  --dur-base:    220ms;
  --dur-rise:    420ms;
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: fehlende Design-System-Tokens zu :root ergänzen"
```

---

## Task 3: Konfliktierende `:root`-Blöcke entfernen

**Files:**
- Modify: `frontend/src/styles.css`

Die späteren `:root`-Blöcke überschreiben den kanonischen Stand. Sie werden chirurgisch entfernt; die nachfolgende Komponenten-CSS jedes Abschnitts bleibt erhalten.

- [ ] **Step 1: `:root`-Block aus "Redesign Draft 2026-04-23" entfernen**

Den gesamten folgenden Block (ca. Zeilen 4468–4492) löschen — erkennbar am Kommentar davor und den overriding-Farben:

```css
/* Redesign Draft 2026-04-23 */

:root {
  --font-display: "Newsreader", "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-family: "Plus Jakarta Sans", "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  color: #1b1c1a;
  background: #fbf9f5;
  --bg: #fbf9f5;
  --surface: rgba(251, 249, 245, 0.92);
  --surface-soft: rgba(245, 243, 239, 0.86);
  --line: rgba(69, 72, 60, 0.12);
  --text: #1b1c1a;
  --muted: #686344;
  --accent: #556b2f;
  --accent-strong: #394d14;
  --accent-soft: #e6edd6;
  --warn: #b9311b;
  --shadow: 0 18px 44px rgba(27, 28, 26, 0.08);
  --shadow-strong: 0 34px 96px rgba(27, 28, 26, 0.14);
  --tomato: #b9311b;
  --lemon: #e8d28f;
  --ink-soft: rgba(27, 28, 26, 0.72);
  --radius-sm: 14px;
  --radius-md: 26px;
  --radius-lg: 34px;
  --page-max: 1420px;
}
```

Ersetzen durch einen einzeiligen Kommentar:
```css
/* Redesign Draft 2026-04-23 – :root-Block nach oben konsolidiert */
```

- [ ] **Step 2: `body`-Font-Override aus dem Redesign-Draft-Abschnitt entfernen**

Den direkt folgenden `body`-Block (nur der `font-family`-Override, ca. Zeilen 4494–4508) entfernen:

```css
body {
  font-family: "Plus Jakarta Sans", "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  background:
    radial-gradient(circle at 0% 0%, rgba(232, 210, 143, 0.28), transparent 24rem),
    radial-gradient(circle at 100% 0%, rgba(85, 107, 47, 0.12), transparent 28rem),
    radial-gradient(circle at 100% 100%, rgba(185, 49, 27, 0.08), transparent 26rem),
    linear-gradient(180deg, #fdfbf7 0%, #f7f2e9 52%, #f1efe8 100%);
}
```

Dieser Block nutzt die olive-Palette und weicht von der kanonischen Creme-Basis ab.

- [ ] **Step 3: `:root`-Block aus "Pitch UI Sprint" entfernen**

Den folgenden Block (ca. Zeilen 5975–5998) löschen:

```css
/* Pitch UI sprint: Stitch handoff "Mahlio Reserve", 2026-04-27. */
:root {
  font-family: "Plus Jakarta Sans", "Avenir Next", "Segoe UI", sans-serif;
  --font-display: "Newsreader", "Iowan Old Style", Georgia, serif;
  --bg: #fbf8f1;
  --surface: rgba(255, 253, 248, 0.82);
  --surface-soft: rgba(246, 243, 236, 0.82);
  --line: rgba(68, 72, 63, 0.1);
  --text: #182317;
  --muted: #676b5e;
  --accent: #526442;
  --accent-strong: #3b4c2c;
  --accent-soft: #dbe8be;
  --warn: #b94b2f;
  --tomato: #b94b2f;
  --lemon: #e8d28f;
  --ink-soft: rgba(24, 35, 23, 0.72);
  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 28px;
  --page-max: 1480px;
  --header-offset: 94px;
  --shadow: 0 18px 44px rgba(27, 28, 26, 0.07);
  --shadow-strong: 0 28px 78px rgba(27, 28, 26, 0.12);
}
```

Ersetzen durch:
```css
/* Pitch UI Sprint 2026-04-27 – :root-Block nach oben konsolidiert */
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: konflikierende :root-Blöcke entfernen, kanonische Palette wiederherstellen"
```

---

## Task 4: Hardcodierte Farb-Overrides aus den Iterationsabschnitten bereinigen

**Files:**
- Modify: `frontend/src/styles.css`

Die Redesign-Draft-Sektion enthält `.button-primary`-Overrides mit hardcodierten olive-Farben (`#556b2f`). Diese müssen entfernt oder auf CSS-Variablen umgestellt werden, damit die Buttons die kanonische sage-Palette zeigen.

- [ ] **Step 1: `.button-primary`-Override im Redesign-Draft-Abschnitt auf Variablen umstellen**

Den folgenden Block finden (direkt nach dem gelöschten `body`-Block im Redesign-Draft-Abschnitt):

```css
.button-primary {
  color: #ffffff;
  background: linear-gradient(135deg, #556b2f 0%, #6d7d43 54%, #8c8b62 100%);
  box-shadow: 0 14px 30px rgba(85, 107, 47, 0.2);
}

.button-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #394d14 0%, #556b2f 100%);
}
```

Diesen Block löschen — die `frontend/src/styles.css` enthält weiter oben bereits die korrekte `.button-primary`-Definition auf Basis der kanonischen Variablen.

- [ ] **Step 2: `.button-secondary`-Override im selben Abschnitt löschen**

Den folgenden Block finden und löschen:

```css
.button-secondary {
  border-color: rgba(69, 72, 60, 0.12);
  background: rgba(255, 255, 255, 0.7);
  color: var(--text);
}

.button-secondary:hover:not(:disabled) {
  border-color: rgba(85, 107, 47, 0.28);
  background: rgba(255, 255, 255, 0.94);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: hardcodierte olive-Farb-Overrides entfernen, kanonische Button-Stile wiederherstellen"
```

---

## Task 5: Fehlende Komponenten-CSS-Klassen ergänzen

**Files:**
- Modify: `frontend/src/styles.css` (am Ende, neuer kommentierter Block)

- [ ] **Step 1: `.lead`-Klasse ergänzen (falls nicht vorhanden)**

Überprüfen ob `.lead` bereits definiert ist:
```bash
grep -n "^\.lead" frontend/src/styles.css
```

Falls kein Treffer: Am Ende von `styles.css` einfügen:

```css
/* ── Design System Ergänzungen ── */

.lead {
  color: var(--ink-soft);
  font-size: 1.1rem;
  line-height: var(--lh-reading);
  max-width: 48ch;
}
```

- [ ] **Step 2: `.surface`-Klasse als generische Card-Klasse ergänzen**

Überprüfen:
```bash
grep -n "^\.surface {" frontend/src/styles.css
```

Falls kein Treffer (es gibt `.surface-header`, aber kein eigenständiges `.surface`):

```css
.surface {
  border: 1px solid rgba(18, 33, 29, 0.08);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(18px);
}
```

- [ ] **Step 3: Focus-Ring-Regel mit Lemon-Aura sicherstellen**

Überprüfen:
```bash
grep -n "focus-visible\|outline.*rgba(244" frontend/src/styles.css | head -10
```

Falls noch kein globaler Lemon-Focus-Ring definiert ist:

```css
:focus-visible {
  outline: 3px solid rgba(244, 201, 93, 0.72);
  outline-offset: 3px;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: fehlende Komponenten-Klassen (.lead, .surface, focus-ring) ergänzen"
```

---

## Task 6: Build-Verifikation

**Files:**
- Read: `frontend/package.json` (Build-Kommando sicherstellen)

- [ ] **Step 1: Build ausführen**

```bash
cd frontend && npm run build 2>&1 | tail -30
```

Erwartetes Ergebnis: `✓ built in ...` ohne Fehler. TypeScript-Fehler würden hier erscheinen, da `vite build` auch den TS-Check durchführt.

- [ ] **Step 2: Dev-Server kurz starten und visuell prüfen**

```bash
cd frontend && npm run dev &
sleep 3
# Browser öffnen: http://localhost:5173
# Prüfen: Schrift ist Plus Jakarta Sans (Headings: Newsreader), Farbe sage-grün #1a8a63
# Buttons zeigen das richtige sage-Grün, nicht olive
# Login-Seite, Dashboard, Header sehen korrekt aus
kill %1
```

- [ ] **Step 3: Finalen Commit auf PR-Branch pushen**

```bash
git push origin fix/api-image-pull-policy
```

---

## Self-Review

**Spec-Abdeckung:**
- ✅ Token-Konsolidierung: Tasks 1 + 2
- ✅ Konfliktierende `:root`-Blöcke entfernen: Task 3
- ✅ Hardcodierte Farb-Overrides bereinigen: Task 4
- ✅ Fehlende Komponenten-CSS: Task 5
- ✅ Build-Verifikation: Task 6

**Hinweis zum Scope:** React-Komponenten (TSX) müssen nicht geändert werden. Die bestehenden Klassen (`.button-primary`, `.eyebrow`, `.plan-stage` etc.) entsprechen bereits dem Design System. Der Plan ändert ausschließlich `styles.css`.

**Placeholder-Check:** Keine TBDs oder unvollständigen Schritte vorhanden.

**Typ-Konsistenz:** CSS-only, keine Typ-Konflikte.
