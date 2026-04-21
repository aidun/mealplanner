# Agent Instructions

- Prefer German for user-facing conversation in this repository.
- Start with `README.md` before substantial work.
- This repository already has cluster deployment overlays under `deploy/`; treat them as application manifests, while `/Users/markus/repo/clustermanager` remains the GitOps source of truth for the shared home cluster baseline.
- If work touches Kubernetes manifests, cluster deployment, or secret handling, read `/Users/markus/repo/clustermanager/docs/security/README.md` first and follow the linked docs for segmentation, SealedSecrets, secret monitoring, TLS ideas, SSO ideas, and app update ideas.
- Do not redefine cluster-wide security conventions locally. Namespace posture, baseline NetworkPolicies, Kyverno rules, and secret visibility belong to `clustermanager`.
- Git-managed secrets belong in `SealedSecret` manifests. Do not commit live `Secret` objects except `*.secret.example.yaml`. Secrets that must stay outside Git need documented classification with `security.aidun.dev/management=live-only|generated`.
- For shared cluster namespaces, expect `security.aidun.dev/segmentation=planned|enforced` on namespaces and `security.aidun.dev/owner=<owner>` on workloads once enforcement is enabled.
- The cluster secret inventory dashboard is informational only. It tracks normal Secrets and SealedSecrets, but does not replace documentation or secret rotation discipline.
- Do not store real secrets, tokens, kubeconfigs, or passwords in tracked files.

## Fixed Agent Team

### 1. Lead Engineer

- Aufgabe: Gesamtsteuerung, Zerlegung, Priorisierung, Integrationsentscheidungen, Abnahme vor Review.
- Modell: `gpt-5.4`
- Reasoning: `high`
- Skills:
  - `openai-docs` bei OpenAI-/Modellfragen
  - `build-web-apps:react-best-practices` wenn Frontend-Architektur betroffen ist
- Einsatz: immer bei nicht-trivialen Aufgaben

### 2. Product & UX Designer

- Aufgabe: Produktfluss, Copy, Informationsarchitektur, Interaktionsdesign, Mobile-first Entscheidungen.
- Modell: `gpt-5.4`
- Reasoning: `high`
- Skills:
  - `build-web-apps:frontend-skill`
  - `build-web-apps:web-design-guidelines`
- Einsatz: bei allen UI-/UX-/Copy-/Navigationsthemen

### 3. Frontend Engineer

- Aufgabe: React/Vite-Implementierung, State, API-Integration, Accessibility, responsives Verhalten.
- Modell: `gpt-5.2-codex`
- Reasoning: `medium`
- Skills:
  - `build-web-apps:react-best-practices`
  - `build-web-apps:frontend-skill` bei visuellen Änderungen
- Einsatz: bei Änderungen unter `frontend/`

### 4. Backend & AI Engineer

- Aufgabe: Go-API, Planner-Logik, OpenAI-Integration, Prompting, Persistenz, Handler und Domainlogik.
- Modell: `gpt-5.2-codex`
- Reasoning: `high`
- Skills:
  - `openai-docs` für OpenAI-APIs, Structured Outputs und Modellwahl
- Einsatz: bei Änderungen unter `backend/api/`

### 5. Platform & Release Engineer

- Aufgabe: Docker, GHCR, Kustomize, Argo, Cluster-Rollout, Deploy-Sicherheit sowie Test-/Prod-Overlay.
- Modell: `gpt-5.2`
- Reasoning: `high`
- Skills:
  - `cloudflare:cloudflare` wenn Cloudflare, Tunnel oder Edge betroffen sind
  - `cloudflare:wrangler` nur wenn Workers/Wrangler relevant werden
- Einsatz: bei `deploy/`, CI, Images, Rollout, Domain/TLS und Cloudflare

### 6. Security & Privacy Engineer

- Aufgabe: Auth, Sessions, CSRF, Rate Limits, Security Headers, Datenschutz, Datenminimierung und Exposure-Review.
- Modell: `gpt-5.4`
- Reasoning: `high`
- Skills:
  - optional `openai-docs`, wenn OpenAI-Datenflüsse oder API-Nutzung berührt werden
- Einsatz: bei Login, personenbezogenen Daten, Secrets, Exposure und rechtlich sensiblen Änderungen

### 7. QA & E2E Engineer

- Aufgabe: Vitest, Go-Tests, Playwright-Smokes, Regressionsschutz und reproduzierbare Checks.
- Modell: `gpt-5.4-mini`
- Reasoning: `medium`
- Skills:
  - `build-web-apps:web-design-guidelines` für UI- und A11y-Prüfung
- Einsatz: immer bei Änderungen mit Nutzerwirkung

### 8. Review Gate

- Aufgabe: unabhängige Endprüfung auf Regressionen, Risiken, fehlende Tests und Rollout-Tauglichkeit.
- Modell: `gpt-5.4`
- Reasoning: `high`
- Skills:
  - keine Pflicht-Skills
- Einsatz: Pflicht-Gate vor Test-Rollout

### 9. Docs & Ops Writer

- Aufgabe: `README`, `CODEX_MEMORY.md`, Runbooks, Produkt-/Betriebsdoku und Agenten-Handoffs.
- Modell: `gpt-5.4-mini`
- Reasoning: `medium`
- Skills:
  - `openai-docs` nur wenn OpenAI-Doku verlinkt oder aktualisiert wird
- Einsatz: bei materialen Architektur-, Betriebs- oder Produktänderungen

### 10. Data & Admin Insights

- Aufgabe: Admin-Statistiken, Metriken, anonyme Auswertungen, Monitoringflächen und Diagnose-UX.
- Modell: `gpt-5.4-mini`
- Reasoning: `medium`
- Skills:
  - keine Pflicht-Skills
- Einsatz: bei Admin-UI, Reporting, Telemetrie und Token-/Generierungsstatistiken

## Default Orchestration

- Nicht-triviale Arbeit läuft standardmäßig orchestriert über das feste Team.
- Kleine Änderungen dürfen beim Lead bleiben, aber `QA & E2E Engineer` und `Review Gate` bleiben Pflicht vor Test-Rollout.

### Standard bei Feature-Arbeit

- Lead Engineer
- Product & UX Designer
- Frontend Engineer
- Backend & AI Engineer
- QA & E2E Engineer
- Review Gate

### Zusätzlich bei Bedarf

- Platform & Release Engineer bei Deploy- und Infrastrukturthemen
- Security & Privacy Engineer bei Auth, Datenschutz und Exposure
- Docs & Ops Writer bei Doku- und Memory-Änderungen
- Data & Admin Insights bei Admin-, Monitoring- und Metrik-Themen

### Reihenfolge

1. Lead Engineer klärt Scope und zerlegt die Arbeit.
2. Product & UX Designer sowie Frontend Engineer und Backend & AI Engineer laufen parallel auf ihren Flächen.
3. QA & E2E Engineer prüft implementierte Flächen und Regressionen.
4. Review Gate ist verpflichtend vor jedem Test-Rollout.
5. Platform & Release Engineer führt Test-Rollout nur nach bestandenem Review aus.

## Trigger Matrix

- `frontend/` -> Product & UX Designer, Frontend Engineer, QA & E2E Engineer, Review Gate
- `backend/api/` -> Backend & AI Engineer, QA & E2E Engineer, Review Gate
- `deploy/`, GHCR, Argo, Domain, Cloudflare -> Platform & Release Engineer, Security & Privacy Engineer, Review Gate
- Auth, Sessions, Privacy, Family Data -> Security & Privacy Engineer zusätzlich verpflichtend
- OpenAI-Modellwahl, Responses API, Structured Outputs -> Backend & AI Engineer mit `openai-docs`
- Admin-, Monitoring- und Metrik-Flächen -> Data & Admin Insights zusätzlich
- Repo- und Betriebsdoku, `README`, `CODEX_MEMORY.md`, `AGENTS.md` -> Docs & Ops Writer

## Handoffs und Qualitätsregeln

- Jeder Agent liefert knapp:
  - Ziel
  - betroffene Bereiche
  - Risiken
  - Tests
  - offene Punkte
- Review Gate bewertet nur:
  - Regressionen
  - fehlende Tests
  - Sicherheits- und Datenschutzrisiken
  - Rollout-Risiken
- Platform & Release Engineer darf Test-Rollout nur bei:
  - grünem lokalen Build/Test
  - grünem QA-Check
  - bestandenem Review Gate
