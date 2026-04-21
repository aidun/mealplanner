# Mealplanner Memory

Last updated: 2026-04-21

## Kontext

- Familien-Webapp fuer Wochen-Essensplaene mit Go-API, React/Vite-Frontend und Cluster-Deployments unter `deploy/`.
- Produktiver Zugang laeuft ueber `https://mealplanner.markushartmann.dev`.
- `AGENTS.md` definiert seit 2026-04-21 ein festes Agententeam fuer nicht-triviale Arbeit: Lead Engineer, Product & UX Designer, Frontend Engineer, Backend & AI Engineer, Platform & Release Engineer, Security & Privacy Engineer, QA & E2E Engineer, Review Gate, Docs & Ops Writer sowie Data & Admin Insights.
- Default-Orchestrierung fuer dieses Repo: nicht-triviale Arbeit laeuft standardmaessig ueber das feste Team; kleine Aenderungen duerfen beim Lead bleiben, aber QA und Review Gate bleiben Pflicht vor Test-Rollout.
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

## Wichtige Arbeitsregeln

- Fuer Cluster-Sicherheitsbaseline, Segmentierung, SealedSecrets und Secret-Monitoring ist `/Users/markus/repo/clustermanager/docs/security/README.md` die verbindliche Einstiegsstelle.
- `/Users/markus/repo/clustermanager` bleibt die GitOps-Quelle fuer clusterweite Labels, Baseline-NetworkPolicies, Kyverno-Regeln und Security-Monitoring.
- Git-verwaltete Secrets sollen als `SealedSecret` gepflegt werden. Echte `Secret`-Manifeste gehoeren nicht ins Repo, ausser `*.secret.example.yaml`.
- Live-only/generated Secrets muessen ausserhalb von Git bleiben und bei Bedarf mit `security.aidun.dev/management=live-only|generated` dokumentiert werden.

## Offene Hinweise

- TLS-, SSO- und App-Update-Strategien fuer den Home-Cluster sind in `clustermanager/docs/security/` aktuell bewusst Ideen-Dokumente und keine sofort umzusetzenden Vorgaben.
- `mealplanner-test` bleibt die Spielwiese fuer UI-/Prompt-Debug und schnellere Produktiteration; Production soll diese Debug-Ausgaben nicht erhalten.
