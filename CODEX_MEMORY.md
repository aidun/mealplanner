# Mealplanner Memory

Last updated: 2026-04-21

## Kontext

- Familien-Webapp fuer Wochen-Essensplaene mit Go-API, React/Vite-Frontend und Cluster-Deployments unter `deploy/`.
- Produktiver Zugang laeuft ueber `https://mealplanner.markushartmann.dev`.
- `AGENTS.md` definiert seit 2026-04-21 ein festes Agententeam fuer nicht-triviale Arbeit: Lead Engineer, Product & UX Designer, Frontend Engineer, Backend & AI Engineer, Platform & Release Engineer, Security & Privacy Engineer, QA & E2E Engineer, Review Gate, Docs & Ops Writer sowie Data & Admin Insights.
- Fuer Dokumentation gilt seit 2026-04-21 explizit: Markdown-Dateien im Repo muessen technisches Doku-Niveau haben, Quellcode-Dokumentation muss professionell gepflegt sein, und das Backend braucht eine aktuelle API-Dokumentation bei Endpunkt- oder Vertragsaenderungen.
- Architektur- und Systemdokumentation gelten seit 2026-04-21 als laufend zu pflegende Pflichtdokumente und muessen bei Aenderungen an Services, Datenfluessen, SaaS-Diensten, Deployments oder Betriebsverhalten aktualisiert werden.
- Default-Orchestrierung fuer dieses Repo: nicht-triviale Arbeit laeuft standardmaessig ueber das feste Team; kleine Aenderungen duerfen beim Lead bleiben, aber QA und Review Gate bleiben Pflicht vor Test-Rollout.
- Ab 2026-04-21 werden UI-Aenderungen verbindlich ueber drei Geraeteklassen beurteilt: Desktop, Tablet und Handy. Layout-/Spacing-/Overlap-Probleme muessen pro Breakpoint explizit geprueft werden.
- Das Frontend hat seit 2026-04-21 ein gestrafftes UI-System fuer Dashboard/Meal-Workspace: ruhigeres Header-Layout, staerkere Wochenflaeche, dichteres MealBoard, klarere Inspector-Zusammenfassung, sichtbare Bring-Labels und 44px-Touch-Ziele fuer zentrale Aktionen; Desktop- und Mobile-Viewport wurden zusaetzlich per Playwright-Mockfluss auf Overflow und Pane-Wechsel geprueft.
- Test/LAN-Zugang nutzt aktuell `192.168.2.204` plus Cloudflare Tunnel.
- Testumgebung aktiviert `PROMPT_DEBUG=true` und liefert unter `/api/debug/prompts/latest` den letzten Prompt, eine kurze Historie sowie aggregierte OpenAI-Request-/Token-Metriken fuer das Overlay.
- Prompt-Debug-Eintraege haben seit `0005_prompt_debug_meta` optionales `meta`-JSONB fuer schlanke Diagnosekontexte wie `requestedWeekStart`, `members`, `favorites`, `mealID` und Merge-Groessen.
- Frontend hat neben Vitest jetzt einen kleinen Playwright-Smoke unter `frontend/e2e/smoke.spec.ts`, der den Hauptfluss mit Profil, Wochenplan, Regeneration, Favorit und Bring-Link gegen gemockte APIs prueft.
- Der Planner plausibilisiert generierte Meals nach der Provider-Antwort: leere/unsaubere Zutaten und Schritte werden bereinigt, fehlende Portionen werden aus dem Profil abgeleitet und stark abweichende Kalorien werden aus Makros hergeleitet; Warnungen landen an der Mahlzeit.
- Seit `666bd9f` schaetzt der Planner Nährwerte zusaetzlich aus Zutaten und Portionsgroessen mit einer kleinen lokalen Heuristik und markiert die Herkunft ueber `meal.meta.nutritionSource`.
- Die API hat jetzt Request-ID-Header, Recover- und Rate-Limit-Middleware fuer sensible Pfade; Frontend-Fehler koennen `requestId` freundlich anzeigen.
- Das Dashboard hat eine staerkere Favoritenflaeche mit Slot-Filter und kompakter Sammlung; die Legal-Seiten beschreiben den aktuellen technischen Stand klarer, bleiben aber keine Rechtsberatung.
- Seit dem Production-Readiness-Block trennt `APP_ENV` die Betriebsarten: Prompt-Debug ist nur aktiv, wenn `APP_ENV=test` und `PROMPT_DEBUG=true`; Production validiert beim API-Start HTTPS-Auth-Base-URL, Session-Secret, Allowlist, Google-Credentials, CORS und Live-OpenAI-Key.
- `deploy/base/api-deployment.yaml` ist jetzt konservativ (`APP_ENV=development`, `PROVIDER_MODE=mock`, `startupProbe`, Standard-Rate-Limit); Test/Production setzen `APP_ENV` und `PROVIDER_MODE` explizit im Overlay.
- `deploy/production` enthaelt PodDisruptionBudgets fuer `api` und `frontend`, und `docs/PRODUCTION_READINESS.md` sammelt die letzte Produktions-Checkliste inklusive der optionalen Legal-Build-Variablen `VITE_LEGAL_*`.
- Frontend-Prompt-Debug kann im Produktions-Build nicht mehr per `localStorage` erzwungen werden; Test-Builds aktivieren es ueber `VITE_PROMPT_DEBUG=true`.
- Seit 2026-04-21 ist die Mail-Integration auf Resend ausgebaut: `user_settings` steuern pro Login `weeklyPlanEmailEnabled` und `recipeEmailEnabled`, Familien-Einladungen bleiben davon unberuehrt, Premium gilt familienweit sobald ein Familienlogin in `premium_users` liegt.
- Admin kann Mail-Templates fuer `family_invite`, `premium_invite` und `weekly_plan_ready` direkt in der App pflegen; die Vorlagen werden in `mail_templates` gespeichert und zur Laufzeit mit festen Platzhaltern wie `{{family_name}}`, `{{invite_link}}`, `{{week_start}}`, `{{plan_url}}`, `{{app_url}}` und `{{support_email}}` gerendert.
- Test-Deployments aktivieren Mail jetzt standardmaessig ueber `EMAIL_ENABLED=true` und `EMAIL_PROVIDER=resend`; fuer echte Zustellung werden weiterhin ein gueltiger `RESEND_API_KEY` und eine bei Resend verifizierte Sender-Domain fuer `markushartmann.dev` benoetigt.
- Seit 2026-04-21 gibt es eine zentrale Architekturseite unter `docs/ARCHITECTURE.md`, die Frontend, API, Postgres, Traefik/Entrypoint, Cloudflare Tunnel, OpenAI, Google OIDC, Resend, Bring, Monitoring, GitOps und Umgebungen zusammenfasst.
- Seit 2026-04-21 ist Phase 1 der Cluster-Security-Anpassung im Repo verankert: Namespace-Segmentierung bleibt `planned`, Workloads tragen `security.aidun.dev/owner=mealplanner`, Baseline-NetworkPolicies sind markiert und App-Secrets werden als `live-only` klassifiziert und im Bootstrap nachgelabelt.

## Wichtige Arbeitsregeln

- Fuer Cluster-Sicherheitsbaseline, Segmentierung, SealedSecrets und Secret-Monitoring ist `/Users/markus/repo/clustermanager/docs/security/README.md` die verbindliche Einstiegsstelle.
- `/Users/markus/repo/clustermanager` bleibt die GitOps-Quelle fuer clusterweite Labels, Baseline-NetworkPolicies, Kyverno-Regeln und Security-Monitoring.
- Git-verwaltete Secrets sollen als `SealedSecret` gepflegt werden. Echte `Secret`-Manifeste gehoeren nicht ins Repo, ausser `*.secret.example.yaml`.
- Live-only/generated Secrets muessen ausserhalb von Git bleiben und bei Bedarf mit `security.aidun.dev/management=live-only|generated` dokumentiert werden.

## Offene Hinweise

- TLS-, SSO- und App-Update-Strategien fuer den Home-Cluster sind in `clustermanager/docs/security/` aktuell bewusst Ideen-Dokumente und keine sofort umzusetzenden Vorgaben.
- `mealplanner-test` bleibt die Spielwiese fuer UI-/Prompt-Debug und schnellere Produktiteration; Production soll diese Debug-Ausgaben nicht erhalten.
