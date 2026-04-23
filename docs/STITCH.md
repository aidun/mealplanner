# Stitch fuer Frontendarbeit

Stand: 2026-04-23

Diese Seite beschreibt, wie `mealplanner` Google Stitch fuer Frontend- und Design-Arbeit nutzt.
Stitch ist hier bewusst ein vorgeschaltetes Design-, Screenshot- und Handoff-Werkzeug. Die
produktive Umsetzung bleibt repo-nativ in React/Vite.

## Ziel

- schnellere Exploration fuer neue Screens, Layoutvarianten und Markenflaechen
- klarerer Handoff zwischen `Nova` und `Flux`
- bessere visuelle Referenz fuer spaetere Code-Umsetzung, ohne das Repo an generierten Code zu binden

## AGENT-Einordnung

Stitch wird nur sinnvoll, wenn die Aufgabe vorher sauber durch `Atlas` eingerahmt ist.

- `Atlas` setzt Scope, Produktziel, Grenzen und betroffene Screens
- `Nova` erzeugt Varianten, Flow-Ideen und visuelle Richtungen in Stitch
- `Flux` extrahiert den relevanten Design-Kontext ueber Stitch-MCP und setzt die ausgewaehlte Richtung in `frontend/` um
- `Probe` verifiziert die reale UI im Browser gegen Desktop, Tablet und Handy
- `Gate` prueft Produktqualitaet, Regressionen, Testluecken und Rollout-Risiken

## Zugeordnete Agenten

- `Atlas`: entscheidet, ob Stitch fuer die Aufgabe sinnvoll ist, und fixiert den Designrahmen
- `Nova`: nutzt Stitch fuer Produktfluss, Screen-Aufbau, Copy-Richtung und mobile Dichte zusammen mit `build-web-apps:frontend-skill` und `build-web-apps:web-design-guidelines`
- `Flux`: nutzt Stitch-MCP fuer Design-Kontext, Bilder und Handoff-Artefakte; kombiniert dies mit `build-web-apps:react-best-practices` und bei visuellen Aufgaben mit `build-web-apps:frontend-skill`, implementiert die finale UI aber repo-nativ
- `Probe`: testet nicht Stitch, sondern die echte umgesetzte UI
- `Gate`: gibt nicht Stitch-Varianten frei, sondern nur den produktiven Repo-Stand

## MCP-Setup

Die globale Codex-Konfiguration enthaelt einen Stitch-MCP-Server:

```toml
[mcp_servers.stitch]
command = "npx"
args = ["-y", "@_davideast/stitch-mcp", "proxy"]
```

Der Key liegt nur in der ungetrackten Codex-Konfiguration ausserhalb des Repos, nicht in
`mealplanner`.

Quellen:

- [davideast/stitch-mcp](https://github.com/davideast/stitch-mcp)
- [Google Labs Stitch](https://stitch.withgoogle.com)

## Einmalige lokale Vorbereitung

1. Sicherstellen, dass `node`, `npm` und `npx` verfuegbar sind.
2. Entweder API-Key in der globalen Codex-Konfiguration nutzen oder Stitch-Init ausfuehren:

```sh
npx -y @_davideast/stitch-mcp init -c codex
```

3. Falls ein bestehendes `gcloud` genutzt werden soll:

```sh
gcloud auth application-default login
gcloud config set project <PROJECT_ID>
gcloud beta services mcp enable stitch.googleapis.com --project=<PROJECT_ID>
```

4. Optional lokal pruefen:

```sh
npx -y @_davideast/stitch-mcp doctor --verbose
```

## Empfohlener Arbeitsablauf

1. `Atlas` beschreibt Ziel, Constraints, Breakpoints, Branding und fachliche Regeln.
2. `Nova` erzeugt in Stitch Varianten fuer den relevanten Screen oder Flow.
3. `Flux` liest ueber Stitch-MCP die noetigen Screens, Bilder oder Screen-Code als Referenz und uebertraegt die Richtung mit Repo-Standards in produktiven Frontend-Code.
4. `Flux` implementiert die finale Oberflaeche in `frontend/`.
5. `Probe` prueft die echte UI lokal und spaeter gegen `mealplanner-test`.
6. `Gate` bewertet Freigabe, Testluecken und Rollout-Risiken.

## Harte Regeln fuer `mealplanner`

- Stitch-Code ist kein blind zu uebernehmender Produktionscode.
- `Mahlio`-Branding, Familien-/Premium-Regeln und bestehende Produktcopy haben Vorrang vor generierten Vorschlaegen.
- Mobile, Tablet und Desktop muessen in der echten React-Umsetzung bewertet werden.
- Stitch ist fuer Exploration, Screenshots, Varianten und Handoff stark; Verifikation passiert im Repo und in der Testumgebung.
