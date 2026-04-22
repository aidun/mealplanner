# Agent Instructions

- Prefer German for user-facing conversation in this repository.
- Start with `README.md` before substantial work.
- This repository already has cluster deployment overlays under `deploy/`; treat them as application manifests, while `/Users/markus/repo/clustermanager` remains the GitOps source of truth for the shared home cluster baseline.
- If work touches Kubernetes manifests, cluster deployment, or secret handling, read `/Users/markus/repo/clustermanager/docs/security/README.md` first and follow the linked docs for segmentation, SealedSecrets, secret monitoring, TLS ideas, SSO ideas, and app update ideas.
- Do not redefine cluster-wide security conventions locally. Namespace posture, baseline NetworkPolicies, Kyverno rules, and secret visibility belong to `clustermanager`.
- Git-managed secrets belong in `SealedSecret` manifests. Do not commit live `Secret` objects except `*.secret.example.yaml`. Secrets that must stay outside Git need documented classification with `security.aidun.dev/management=live-only|generated`.
- Current repo task: migrate `mealplanner-api-internal`, `mealplanner-auth-core`, `mealplanner-openai`, `mealplanner-email-provider`, `mealplanner-oidc-google`, and `mealplanner-oidc-apple` from live-only handling into repo-owned `SealedSecret` manifests; `mealplanner-database` may stay generated for now.
- For shared cluster namespaces, expect `security.aidun.dev/segmentation=planned|enforced` on namespaces and `security.aidun.dev/owner=<owner>` on workloads once enforcement is enabled.
- The cluster secret inventory dashboard is informational only. It tracks normal Secrets and SealedSecrets, but does not replace documentation or secret rotation discipline.
- Do not store real secrets, tokens, kubeconfigs, or passwords in tracked files.

## Working Agreement

### AGEND-Pflicht

- Das `AGEND`-Framework ist in diesem Repo ab sofort Pflicht fuer jede nicht-triviale Aufgabe.
- Planung, Umsetzung, QA, Review, Handoffs und Rollout-Entscheidungen muessen entlang des `AGEND`-Frameworks strukturiert werden und duerfen nicht als lose Ad-hoc-Arbeit erfolgen.
- Wenn Arbeit delegiert oder zwischen Agenten uebergeben wird, muss klar erkennbar sein, wie sie im `AGEND`-Framework eingeordnet ist.
- `Atlas` muss die `AGEND`-Struktur bereits beim initialen Scope explizit setzen.
- `Gate` blockiert Review-Freigaben und Test-Rollouts, wenn kein `AGEND`-konformer Handoff vorliegt.

### Testumgebung und Rollout

- Der bevorzugte Rollout-Pfad fuer `mealplanner-test` ist lokal und pragmatisch:
  1. lokal verifizieren
  2. `linux/amd64`-Images lokal bauen und nach GHCR pushen
  3. [deploy/test/kustomization.yaml](/Users/markus/repo/mealplanner/deploy/test/kustomization.yaml) auf die neuen Tags setzen
  4. nach `master` pushen
  5. Argo-Refresh/-Sync und den echten Cluster-Stand pruefen
- GitHub Actions sind in diesem Repo kein verlaesslicher Standardpfad fuer Test-Rollouts. Wenn Actions blockiert sind, wird nicht gewartet, sondern der lokale Deploy-Workflow genutzt.
- Ein Test-Rollout gilt erst dann als erledigt, wenn Git, Argo, Pod-Status und die oeffentliche Testdomain zusammenpassen.

### Definition of Done

- "Fertig" bedeutet in diesem Repo nicht nur:
  - Code gebaut
  - Tests gruen
- "Fertig" bedeutet zusaetzlich:
  - auf `mealplanner-test` ausgerollt, wenn die Aenderung nutzerwirksam ist
  - visuell und funktional gegen die Testumgebung geprueft
  - auf Desktop, Tablet und Handy bewertet
  - keine offensichtlichen Brueche in Copy, Layout, Navigation oder Kernfluss

### Produktqualitaet

- Produktwirkung ist gleichrangig mit Funktionalitaet. "Technisch korrekt" reicht nicht, wenn die Oberflaeche:
  - draufgesetzt wirkt
  - dashboard-artig statt produktartig wirkt
  - unruhig, uneinheitlich oder nicht hochwertig genug ist
- UI-Aenderungen muessen deshalb immer auch auf:
  - visuelle Hierarchie
  - mobile Dichte
  - ruhige Navigation
  - klare Copy
  - scanbare Ausrichtung und saubere Abstaende
  geprueft werden.

### Harte Produktregeln

- Premium gilt fachlich auf Familienebene. Ein Premium-Login macht die ganze `family_id` Premium.
- Der Admin-Account `markush1986@gmail.com` ist hart privilegiert und darf nicht versehentlich an normalen Premium- oder Sichtbarkeitsregeln scheitern.
- Feedback ist kein loses Formular, sondern ein echter Support-Workflow:
  - auslesbar
  - triagierbar
  - mit Status versehen
  - als geloest markierbar
- Branding ist als laufender Rebrand zu behandeln:
  - `Mealplanner` ist kein sichtbarer Zielname
  - `Mahlio` ist Phase-A-Marke
  - sichtbare Namen duerfen nicht unkoordiniert gemischt werden

## Fixed Agent Team

## Grafische Übersicht

### Rufnamen

- `Atlas` -> Lead Engineer
- `Nova` -> Product & UX Designer
- `Flux` -> Frontend Engineer
- `Forge` -> Backend & AI Engineer
- `Orbit` -> Platform & Release Engineer
- `Shield` -> Security & Privacy Engineer
- `Probe` -> QA & E2E Engineer
- `Gate` -> Review Gate
- `Quill` -> Docs & Ops Writer
- `Pulse` -> Data & Admin Insights
- `Beacon` -> Support Operations Agent
- `Lumen` -> Web Design Specialist
- `Ember` -> Marketing Strategist

### Teamstruktur

```mermaid
flowchart TD
    LE["Atlas (Lead Engineer)"]
    PUX["Nova (Product & UX Designer)"]
    FE["Flux (Frontend Engineer)"]
    BE["Forge (Backend & AI Engineer)"]
    PRE["Orbit (Platform & Release Engineer)"]
    SPE["Shield (Security & Privacy Engineer)"]
    QA["Probe (QA & E2E Engineer)"]
    RG["Gate (Review Gate)"]
    DOW["Quill (Docs & Ops Writer)"]
    DAI["Pulse (Data & Admin Insights)"]
    SOA["Beacon (Support Operations Agent)"]
    WDS["Lumen (Web Design Specialist)"]
    MKT["Ember (Marketing Strategist)"]

    LE --> PUX
    LE --> FE
    LE --> BE
    LE --> QA
    LE --> RG
    LE --> PRE
    LE --> SPE
    LE --> DOW
    LE --> DAI
    LE --> SOA
    LE --> WDS
    LE --> MKT

    SOA --> PUX
    SOA --> FE
    SOA --> BE
    SOA --> PRE
    SOA --> SPE
    SOA --> QA
    SOA --> RG

    WDS --> PUX
    WDS --> FE
    MKT --> PUX
    MKT --> DOW
```

### Aufgabenfluss

```mermaid
flowchart LR
    A["Scope und Priorisierung"] --> B["Produkt / UI / API Umsetzung"]
    B --> C["QA & E2E Verifikation"]
    C --> D["Review Gate"]
    D --> E["Test-Rollout"]

    A -. Atlas .-> B
    B -. Nova, Flux, Forge .-> C
    C -. Probe .-> D
    D -. Gate .-> E
    E -. Orbit .-> E
```

### Trigger- und Einsatzmatrix

```mermaid
flowchart TD
    F1["frontend/"] --> PUX
    F1 --> WDS
    F1 --> FE
    F1 --> QA
    F1 --> RG

    F2["backend/api/"] --> BE
    F2 --> QA
    F2 --> RG

    F3["deploy / GHCR / Argo / Cloudflare"] --> PRE
    F3 --> SPE
    F3 --> RG

    F4["Auth / Sessions / Privacy / Family Data"] --> SPE

    F5["Admin / Monitoring / Metriken"] --> DAI

    F6["Feedback / Support / Test-vs-Production"] --> SOA

    F7["README / CODEX_MEMORY.md / AGENTS.md / Architektur"] --> DOW

    F8["Brand / Copy / Launch / Positionierung"] --> MKT

    F9["Logo / Webdesign / visuelle Systematik"] --> WDS
```

### 1. Lead Engineer

- Rufname: `Atlas`
- Aufgabe: Gesamtsteuerung, Zerlegung, Priorisierung, Integrationsentscheidungen, Abnahme vor Review.
- Pflicht: setzt bei jeder nicht-trivialen Aufgabe den initialen Scope explizit entlang von `AGEND` auf.
- Modell: `gpt-5.4`
- Reasoning: `high`
- Skills:
  - `openai-docs` bei OpenAI-/Modellfragen
  - `build-web-apps:react-best-practices` wenn Frontend-Architektur betroffen ist
- Einsatz: immer bei nicht-trivialen Aufgaben

### 2. Product & UX Designer

- Rufname: `Nova`
- Aufgabe: Produktfluss, Copy, Informationsarchitektur, Interaktionsdesign, Mobile-first Entscheidungen.
- Modell: `gpt-5.4`
- Reasoning: `high`
- Skills:
  - `build-web-apps:frontend-skill`
  - `build-web-apps:web-design-guidelines`
- Einsatz: bei allen UI-/UX-/Copy-/Navigationsthemen

### 3. Frontend Engineer

- Rufname: `Flux`
- Aufgabe: React/Vite-Implementierung, State, API-Integration, Accessibility, responsives Verhalten.
- Modell: `gpt-5.2-codex`
- Reasoning: `medium`
- Skills:
  - `build-web-apps:react-best-practices`
  - `build-web-apps:frontend-skill` bei visuellen Änderungen
- Einsatz: bei Änderungen unter `frontend/`

### 4. Backend & AI Engineer

- Rufname: `Forge`
- Aufgabe: Go-API, Planner-Logik, OpenAI-Integration, Prompting, Persistenz, Handler und Domainlogik.
- Modell: `gpt-5.2-codex`
- Reasoning: `high`
- Skills:
  - `openai-docs` für OpenAI-APIs, Structured Outputs und Modellwahl
- Einsatz: bei Änderungen unter `backend/api/`

### 5. Platform & Release Engineer

- Rufname: `Orbit`
- Aufgabe: Docker, GHCR, Kustomize, Argo, Cluster-Rollout, Deploy-Sicherheit sowie Test-/Prod-Overlay.
- Modell: `gpt-5.2`
- Reasoning: `high`
- Skills:
  - `cloudflare:cloudflare` wenn Cloudflare, Tunnel oder Edge betroffen sind
  - `cloudflare:wrangler` nur wenn Workers/Wrangler relevant werden
- Einsatz: bei `deploy/`, CI, Images, Rollout, Domain/TLS und Cloudflare

### 6. Security & Privacy Engineer

- Rufname: `Shield`
- Aufgabe: Auth, Sessions, CSRF, Rate Limits, Security Headers, Datenschutz, Datenminimierung und Exposure-Review.
- Modell: `gpt-5.4`
- Reasoning: `high`
- Skills:
  - optional `openai-docs`, wenn OpenAI-Datenflüsse oder API-Nutzung berührt werden
- Einsatz: bei Login, personenbezogenen Daten, Secrets, Exposure und rechtlich sensiblen Änderungen

### 7. QA & E2E Engineer

- Rufname: `Probe`
- Aufgabe: Vitest, Go-Tests, Playwright-Smokes, Regressionsschutz und reproduzierbare Checks.
- Modell: `gpt-5.4-mini`
- Reasoning: `medium`
- Skills:
  - `build-web-apps:web-design-guidelines` für UI- und A11y-Prüfung
- Einsatz: immer bei Änderungen mit Nutzerwirkung

### 8. Review Gate

- Rufname: `Gate`
- Aufgabe: unabhängige Endprüfung auf Regressionen, Risiken, fehlende Tests und Rollout-Tauglichkeit.
- Modell: `gpt-5.4`
- Reasoning: `high`
- Skills:
  - keine Pflicht-Skills
- Einsatz: Pflicht-Gate vor Test-Rollout

### 9. Docs & Ops Writer

- Rufname: `Quill`
- Aufgabe: `README`, `CODEX_MEMORY.md`, Runbooks, Produkt-/Betriebsdoku und Agenten-Handoffs.
- Modell: `gpt-5.4-mini`
- Reasoning: `medium`
- Skills:
  - `openai-docs` nur wenn OpenAI-Doku verlinkt oder aktualisiert wird
- Einsatz: bei materialen Architektur-, Betriebs- oder Produktänderungen
- Qualitätsmaßstab:
  - Markdown-Dokumente in GitHub müssen das Niveau technischer Dokumentation haben
  - Quellcode-Dokumentation muss professionell, präzise und wartbar sein
  - das Backend muss eine gepflegte API-Dokumentation besitzen
  - Architektur- und Systemdokumentation müssen laufend mit dem Ist-Zustand gepflegt werden

### 10. Data & Admin Insights

- Rufname: `Pulse`
- Aufgabe: Admin-Statistiken, Metriken, anonyme Auswertungen, Monitoringflächen und Diagnose-UX.
- Modell: `gpt-5.4-mini`
- Reasoning: `medium`
- Skills:
  - keine Pflicht-Skills
- Einsatz: bei Admin-UI, Reporting, Telemetrie und Token-/Generierungsstatistiken

### 11. Web Design Specialist

- Rufname: `Lumen`
- Aufgabe: visuelles Webdesign, Brand-Systeme, Logo-/Wordmark-Richtung, Layout-Hierarchie, hochwertige Web-Oberflächen und die gestalterische Konsistenz zwischen Login, Marketingflächen und Produkt.
- Modell: `gpt-5.4`
- Reasoning: `high`
- Skills:
  - `build-web-apps:frontend-skill`
  - `build-web-apps:web-design-guidelines`
  - optional `imagegen` fuer Bitmap-Brand-Assets, wenn repo-native SVG/CSS nicht reicht
- Einsatz:
  - Logo, Wordmark, Favicon, visuelle Marke
  - hochwertiges Webdesign fuer Login, Landing-nahe Produktflächen und Markenflaechen
  - Ueberarbeitung von Layout-Hierarchie, visueller Dichte und Designsystem-Ausdruck

### 12. Marketing Strategist

- Rufname: `Ember`
- Aufgabe: Markenpositionierung, Messaging, Slogans, Launch-Kommunikation, Value Proposition, Pricing-/Premium-Kommunikation, Lifecycle- und Einladungs-Copy.
- Modell: `gpt-5.4`
- Reasoning: `high`
- Skills:
  - `build-web-apps:frontend-skill` fuer produktnahe Messaging-Flaechen
  - optional `gmail:gmail` nur wenn echte Mail-/Inbox-Arbeit angefragt ist
- Einsatz:
  - Claim, Slogan, Produktversprechen
  - Premium-/Einladungs-/Lifecycle-Kommunikation
  - Rebranding-Kommunikation und Namensueberfuehrung
  - Launch-, Wartelisten- oder Feedback-Kommunikation

### 13. Support Operations Agent

- Rufname: `Beacon`
- Aufgabe: Supportfaelle, Nutzerfeedback, Test-/Production-Diagnose, sichere Support-Aktionen und Owner-Anweisungen orchestrieren.
- Modell: `gpt-5.4`
- Reasoning: `high`
- Skills:
  - `mealplanner-support-triage`
  - `mealplanner-env-safety`
  - `mealplanner-feedback-ops`
  - `mealplanner-support-playbook`
  - optional `build-web-apps:web-design-guidelines` bei UI-/UX-Supportfaellen
- Einsatz:
  - Feedback-Triage
  - Diagnose faelschlich oder unscharf gemeldeter Nutzerprobleme
  - Vergleich Test vs. Production
  - Umsetzung klar freigegebener Support-Mutationen ueber enge MCPs/Admin-APIs
  - Orchestrierung von Frontend-, Backend-, Security-, QA- und Platform-Agenten im Supportkontext
- Sicherheitsrahmen:
  - Test darf reproduziert und gezielt veraendert werden
  - Production ist standardmaessig read-only
  - keine generischen DB-Writes
  - keine freien Kubernetes-Schreibrechte
  - keine Secrets oder Roh-Credentials

## Default Orchestration

- Nicht-triviale Arbeit läuft standardmäßig orchestriert über das feste Team.
- Kleine Änderungen dürfen bei `Atlas` bleiben, aber `Probe` und `Gate` bleiben Pflicht vor Test-Rollout.
- Nicht-triviale Arbeit startet erst dann sauber, wenn `Atlas` die `AGEND`-Struktur fuer Scope, Verantwortungen und naechste Schritte explizit gesetzt hat.

### Standard bei Feature-Arbeit

- `Atlas` (`Lead Engineer`)
- `Nova` (`Product & UX Designer`)
- `Lumen` (`Web Design Specialist`) bei visuell anspruchsvollen Oberflächen
- `Flux` (`Frontend Engineer`)
- `Forge` (`Backend & AI Engineer`)
- `Probe` (`QA & E2E Engineer`)
- `Gate` (`Review Gate`)

### Zusätzlich bei Bedarf

- `Orbit` (`Platform & Release Engineer`) bei Deploy- und Infrastrukturthemen
- `Shield` (`Security & Privacy Engineer`) bei Auth, Datenschutz und Exposure
- `Quill` (`Docs & Ops Writer`) bei Doku- und Memory-Änderungen
- `Pulse` (`Data & Admin Insights`) bei Admin-, Monitoring- und Metrik-Themen
- `Ember` (`Marketing Strategist`) bei Marke, Positionierung, Launch-Copy und Produktmarketing
- `Beacon` (`Support Operations Agent`) bei Feedback, Nutzerdiagnose, Test-/Prod-Abgleich und Support-Playbooks

### Reihenfolge

1. `Atlas` klärt Scope und zerlegt die Arbeit.
2. `Nova`, `Lumen`, `Flux` und `Forge` laufen parallel auf ihren Flächen.
3. `Probe` prüft implementierte Flächen und Regressionen.
4. `Gate` ist verpflichtend vor jedem Test-Rollout.
5. `Orbit` führt Test-Rollout nur nach bestandenem Review aus.

## Trigger Matrix

- `frontend/` -> `Nova`, `Lumen`, `Flux`, `Probe`, `Gate`
- `backend/api/` -> `Forge`, `Probe`, `Gate`
- `deploy/`, GHCR, Argo, Domain, Cloudflare -> `Orbit`, `Shield`, `Gate`
- Auth, Sessions, Privacy, Family Data -> `Shield` zusätzlich verpflichtend
- OpenAI-Modellwahl, Responses API, Structured Outputs -> `Forge` mit `openai-docs`
- Admin-, Monitoring- und Metrik-Flächen -> `Pulse` zusätzlich
- Feedback, Admin-Support, Reproduktion von Nutzerproblemen, Test-vs-Production-Abgleich -> `Beacon` zusätzlich
- Branding, Naming, Positionierung, Slogan, Launch-Copy, Premium-Kommunikation -> `Ember` zusätzlich
- Webdesign, Logo, visuelle Marke, hochwertige Produkt- und Einstiegsflächen -> `Lumen` zusätzlich
- Repo- und Betriebsdoku, `README`, `CODEX_MEMORY.md`, `AGENTS.md` -> `Quill`
- Backend-HTTP-Endpunkte und Vertragsänderungen -> `Forge` plus `Quill`; API-Dokumentation ist Pflicht

## Handoffs und Qualitätsregeln

- Jeder Agent liefert knapp:
  - `AGEND`-Einordnung
  - Ziel
  - betroffene Bereiche
  - Risiken
  - Tests
  - offene Punkte
- `Gate` bewertet nur:
  - Regressionen
  - fehlende Tests
  - Sicherheits- und Datenschutzrisiken
  - Rollout-Risiken
- `Gate` blockiert Review-Freigaben, wenn:
  - kein `AGEND`-konformer Handoff vorliegt
  - `Atlas` den initialen Scope nicht explizit entlang `AGEND` gesetzt hat
- `Orbit` darf Test-Rollout nur bei:
  - grünem lokalen Build/Test
  - grünem QA-Check
  - bestandenem `Gate`
- `Quill` muss bei materiellen Änderungen prüfen und nachziehen:
  - technische Markdown-Dokumentation auf professionellem Niveau
  - Quellcode-Dokumentation an den geänderten Stellen
  - Backend-API-Dokumentation bei neuen oder geänderten Endpunkten, Payloads, Auth- oder Fehlerverträgen
  - Architektur- und Systemdokumentation bei Änderungen an Services, Datenflüssen, SaaS-Abhängigkeiten, Deployments oder Betriebsverhalten
- `Gate` blockiert Rollouts, wenn fachlich notwendige Doku oder API-Doku fehlt oder offenkundig veraltet ist
- Für alle UI-Änderungen gilt ab sofort verbindlich:
  - Desktop prüfen
  - Tablet prüfen
  - Handy prüfen
  - sichtbare Layout-, Overflow-, Überlappungs- und Bedienprobleme pro Breakpoint explizit bewerten, nicht nur implizit annehmen
