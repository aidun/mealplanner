# Mealplanner Agent Instructions

- Inherit the shared Codex operating model from `/Users/markus/.codex/AGENTS.md`.
- This file is the repo-specific delta: startup files, rollout rules, product constraints, and security boundaries.
- Prefer German for user-facing conversation in this repository.

## Session Start Pflicht

- Jeder neue Chat in diesem Repo muss vor nicht-trivialer Arbeit zuerst diese Dateien lesen:
  1. `README.md`
  2. `/Users/markus/repo/macbook/MEMORY.md`
  3. `/Users/markus/repo/macbook/MACBOOK_CODING_STATION.md`
  4. `/Users/markus/repo/mealplanner/CODEX_MEMORY.md`
  5. `AGENTS.md`
- Nicht-triviale Arbeit beginnt erst nach diesem Start-Read und einer expliziten Scope-Setzung durch `Atlas`.
- Die Scope-Setzung muss mindestens betroffene Bereiche, Risiken, Testansatz, Rollout-Pfad und die benoetigten Rollen aus dem globalen Agentensystem benennen.

## Memory-System

- `CODEX_MEMORY.md` ist die durable Projekt-Memory fuer `mealplanner` und gehoert zur Pflichtlekture bei nicht-trivialer Arbeit.
- Zusaetzlich muss bei nicht-trivialer Arbeit der globale `memory` MCP mit `mealplanner`, `Mahlio` und aufgabenrelevanten Begriffen abgefragt werden.
- Wenn sich dauerhaft relevante Projektfakten aendern, muss `CODEX_MEMORY.md` aktualisiert werden.
- Wenn die Aenderung fuer zukuenftige Sessions uebergreifend nuetzlich ist, auch den `memory` MCP aktualisieren.
- Fuer globale Setup- oder Agenten-Aenderungen ist stattdessen `/Users/markus/repo/macbook/MEMORY.md` zustaendig.
- Verwende dafuer das globale Vorgehen aus dem Skill `memory-maintenance`; vermeide doppelte oder widerspruechliche Eintraege.

## Repo-Guardrails

- Start with `README.md` before substantial work.
- This repository already has cluster deployment overlays under `deploy/`; treat them as application manifests, while `/Users/markus/repo/clustermanager` remains the GitOps source of truth for the shared home cluster baseline.
- If work touches Kubernetes manifests, cluster deployment, or secret handling, read `/Users/markus/repo/clustermanager/docs/security/README.md` first and follow the linked docs for segmentation, SealedSecrets, secret monitoring, TLS ideas, SSO ideas, and app update ideas.
- Do not redefine cluster-wide security conventions locally. Namespace posture, baseline NetworkPolicies, Kyverno rules, and secret visibility belong to `clustermanager`.
- Git-managed secrets belong in `SealedSecret` manifests. Do not commit live `Secret` objects except `*.secret.example.yaml`.
- Secrets that must stay outside Git need documented classification with `security.aidun.dev/management=live-only|generated`.
- Current repo task: migrate `mealplanner-api-internal`, `mealplanner-auth-core`, `mealplanner-openai`, `mealplanner-email-provider`, `mealplanner-oidc-google`, and `mealplanner-oidc-apple` from live-only handling into repo-owned `SealedSecret` manifests; `mealplanner-database` may stay generated for now.
- Do not store real secrets, tokens, kubeconfigs, or passwords in tracked files.

## Default Role Mapping In This Repo

- Jede nicht-triviale Aufgabe startet mit `Atlas`.
- Frontend, Navigation, Onboarding, Produktcopy und visuelle Richtung: `Atlas` -> `Nova` + `Flux` -> `Probe` -> `Gate`
- Backend, Planner, API, OpenAI, Mail, Persistenz: `Atlas` -> `Forge` -> `Probe` -> `Gate`
- Deploy, GHCR, Argo, Kustomize, Domain, Cloudflare: `Atlas` -> `Orbit` + `Shield` -> `Probe` -> `Gate`
- Security, Auth, Familienkonto, personenbezogene Daten, Exposure: `Atlas` -> `Shield` -> `Gate`
- Externe APIs oder Framework-Unsicherheit: `docs_researcher` zusaetzlich
- Materiale Architektur-, Betriebs- oder Memory-Aenderungen: `Quill` zusaetzlich

## Testumgebung und Rollout

- Der bevorzugte Rollout-Pfad fuer `mealplanner-test` ist lokal und pragmatisch:
  1. lokal verifizieren
  2. `linux/amd64`-Images lokal bauen und nach GHCR pushen
  3. [deploy/test/kustomization.yaml](/Users/markus/repo/mealplanner/deploy/test/kustomization.yaml) auf die neuen Tags setzen
  4. nach `master` pushen
  5. Argo-Refresh/-Sync und den echten Cluster-Stand pruefen
- GitHub Actions sind in diesem Repo kein verlaesslicher Standardpfad fuer Test-Rollouts. Wenn Actions blockiert sind, wird nicht gewartet, sondern der lokale Deploy-Workflow genutzt.
- Ein Test-Rollout gilt erst dann als erledigt, wenn Git, Argo, Pod-Status und die oeffentliche Testdomain zusammenpassen.

## Definition of Done

- "Fertig" bedeutet in diesem Repo nicht nur Build und grüne Tests.
- Fuer nutzerwirksame Aenderungen gilt zusaetzlich:
  - auf `mealplanner-test` ausgerollt, wenn die Aenderung nutzerwirksam ist
  - visuell und funktional gegen die Testumgebung geprueft
  - auf Desktop, Tablet und Handy bewertet
  - keine offensichtlichen Brueche in Copy, Layout, Navigation oder Kernfluss

## Produktqualitaet

- Produktwirkung ist gleichrangig mit Funktionalitaet.
- UI-Aenderungen muessen immer auch auf visuelle Hierarchie, mobile Dichte, ruhige Navigation, klare Copy, scanbare Ausrichtung und saubere Abstaende geprueft werden.
- Premium gilt fachlich auf Familienebene. Ein Premium-Login macht die ganze `family_id` Premium.
- Der Admin-Account `markush1986@gmail.com` ist hart privilegiert und darf nicht versehentlich an normalen Premium- oder Sichtbarkeitsregeln scheitern.
- Feedback ist kein loses Formular, sondern ein echter Support-Workflow: auslesbar, triagierbar, mit Status versehen und als geloest markierbar.
- Branding ist als laufender Rebrand zu behandeln:
  - `Mealplanner` ist kein sichtbarer Zielname
  - `Mahlio` ist Phase-A-Marke
  - sichtbare Namen duerfen nicht unkoordiniert gemischt werden
