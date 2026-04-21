# Mealplanner Memory

Last updated: 2026-04-21

## Kontext

- Familien-Webapp fuer Wochen-Essensplaene mit Go-API, React/Vite-Frontend und Cluster-Deployments unter `deploy/`.
- Produktiver Zugang laeuft ueber `https://mealplanner.markushartmann.dev`.
- Test/LAN-Zugang nutzt aktuell `192.168.2.204` plus Cloudflare Tunnel.
- Testumgebung aktiviert `PROMPT_DEBUG=true` und liefert unter `/api/debug/prompts/latest` den letzten Prompt, eine kurze Historie sowie aggregierte OpenAI-Request-/Token-Metriken fuer das Overlay.
- Prompt-Debug-Eintraege haben seit `0005_prompt_debug_meta` optionales `meta`-JSONB fuer schlanke Diagnosekontexte wie `requestedWeekStart`, `members`, `favorites`, `mealID` und Merge-Groessen.
- Frontend hat neben Vitest jetzt einen kleinen Playwright-Smoke unter `frontend/e2e/smoke.spec.ts`, der den Hauptfluss mit Profil, Wochenplan, Regeneration, Favorit und Bring-Link gegen gemockte APIs prueft.
- Der Planner plausibilisiert generierte Meals nach der Provider-Antwort: leere/unsaubere Zutaten und Schritte werden bereinigt, fehlende Portionen werden aus dem Profil abgeleitet und stark abweichende Kalorien werden aus Makros hergeleitet; Warnungen landen an der Mahlzeit.

## Wichtige Arbeitsregeln

- Fuer Cluster-Sicherheitsbaseline, Segmentierung, SealedSecrets und Secret-Monitoring ist `/Users/markus/repo/clustermanager/docs/security/README.md` die verbindliche Einstiegsstelle.
- `/Users/markus/repo/clustermanager` bleibt die GitOps-Quelle fuer clusterweite Labels, Baseline-NetworkPolicies, Kyverno-Regeln und Security-Monitoring.
- Git-verwaltete Secrets sollen als `SealedSecret` gepflegt werden. Echte `Secret`-Manifeste gehoeren nicht ins Repo, ausser `*.secret.example.yaml`.
- Live-only/generated Secrets muessen ausserhalb von Git bleiben und bei Bedarf mit `security.aidun.dev/management=live-only|generated` dokumentiert werden.

## Offene Hinweise

- TLS-, SSO- und App-Update-Strategien fuer den Home-Cluster sind in `clustermanager/docs/security/` aktuell bewusst Ideen-Dokumente und keine sofort umzusetzenden Vorgaben.
- `mealplanner-test` bleibt die Spielwiese fuer UI-/Prompt-Debug und schnellere Produktiteration; Production soll diese Debug-Ausgaben nicht erhalten.
