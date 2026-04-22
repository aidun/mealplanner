# Mealplanner Memory

Last updated: 2026-04-22

## Kontext

- Familien-Webapp fuer Wochen-Essensplaene mit Go-API, React/Vite-Frontend und Cluster-Deployments unter `deploy/`.
- Produktiver Zugang laeuft ueber `https://mealplanner.markushartmann.dev`.
- `AGENTS.md` definiert seit 2026-04-21 ein festes Agententeam fuer nicht-triviale Arbeit. Seit 2026-04-22 haben alle Rollen kurze Rufnamen fuer direkte Ansprache: `Atlas` (Lead), `Nova` (Product & UX), `Flux` (Frontend), `Forge` (Backend & AI), `Orbit` (Platform & Release), `Shield` (Security & Privacy), `Probe` (QA & E2E), `Gate` (Review Gate), `Quill` (Docs & Ops), `Pulse` (Data & Admin Insights), `Lumen` (Web Design Specialist) und `Ember` (Marketing Strategist).
- Seit 2026-04-22 ist das Agentenmodell um einen geplanten `Support Operations Agent` erweitert: Orchestrator fuer Supportfaelle, Feedback, Test-/Production-Diagnose und sichere Support-Aktionen; direkt umgesetzt sind repo-lokale Skills unter `skills/mealplanner-support-triage`, `skills/mealplanner-env-safety`, `skills/mealplanner-feedback-ops` und `skills/mealplanner-support-playbook`. Vorhandene Laufzeitbausteine sind aktuell `kubernetes-readonly`, `github`, `playwright` sowie bestehende Admin-/App-Flows; `mealplanner-*` MCPs bleiben bewusst Zukunftsthema.
- Der `Support Operations Agent` hat seit 2026-04-22 den Rufnamen `Beacon`.
- Seit 2026-04-22 gibt es zwei zusaetzliche Spezialrollen im Agentenmodell: `Lumen` fuer visuelles Webdesign, Markenflaechen, Logo-/Wordmark-Richtung und hochwertige Oberflaechen; `Ember` fuer Markenpositionierung, Slogans, Launch-Copy, Premium-Kommunikation und produktnahes Marketing.
- Seit 2026-04-22 stellen `AGENTS.md`, `docs/SUPPORT_AGENT.md` und `docs/ARCHITECTURE.md` die Agentenstruktur, Zustaendigkeiten und Aufgabenfluesse grafisch per Mermaid dar; diese Diagramme muessen bei Team- oder Ablaufaenderungen mitgepflegt werden.
- Fuer Dokumentation gilt seit 2026-04-21 explizit: Markdown-Dateien im Repo muessen technisches Doku-Niveau haben, Quellcode-Dokumentation muss professionell gepflegt sein, und das Backend braucht eine aktuelle API-Dokumentation bei Endpunkt- oder Vertragsaenderungen.
- Architektur- und Systemdokumentation gelten seit 2026-04-21 als laufend zu pflegende Pflichtdokumente und muessen bei Aenderungen an Services, Datenfluessen, SaaS-Diensten, Deployments oder Betriebsverhalten aktualisiert werden.
- Default-Orchestrierung fuer dieses Repo: nicht-triviale Arbeit laeuft standardmaessig ueber das feste Team; kleine Aenderungen duerfen beim Lead bleiben, aber QA und Review Gate bleiben Pflicht vor Test-Rollout.
- Seit 2026-04-22 gilt ein explizites projektspezifisches Working Agreement: Test-Rollouts fuer `mealplanner-test` laufen bevorzugt lokal ueber GHCR-Images, `deploy/test/kustomization.yaml`, Push und anschliessenden Argo-/Cluster-Abgleich; GitHub Actions sind dafuer nicht der verlaessliche Standardpfad.
- "Fertig" bedeutet seit 2026-04-22 fuer nutzerwirksame Aenderungen: lokal verifiziert, auf `mealplanner-test` ausgerollt, visuell/funktional geprueft und ueber Desktop, Tablet und Handy bewertet; gruene Tests allein reichen nicht.
- Produktqualitaet wird seit 2026-04-22 explizit als gleichrangig zur Funktion behandelt: produktartige Wirkung, ruhige Navigation, scanbare Ausrichtung, klare Copy und mobile Dichte sind Pflichtkriterien, nicht Nacharbeit.
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
- Seit 2026-04-22 haertet das Backend zwei Konfliktpfade explizit: `POST /api/admin/premium-users` liefert jetzt `409`, wenn die Mail bereits direkt oder familienweit Premium hat (inkl. hart privilegiertem Admin-Login), und Familien-Einladungen liefern `409`, wenn das Zielkonto bereits im aktuellen oder in einem anderen aktiven Familienkonto steckt statt nur still weiterzulaufen.
- Seit 2026-04-22 scannt `store.GetFamily()` `user_settings.updated_at` nullable. Ohne diese Haertung lieferten Haushalts- und Zuordnungspfad fuer Logins ohne gespeicherte Mail-Einstellungen einen `500` auf `/api/family` und indirekt auch bei `PUT /api/family/member-links`.
- Der Admin-Account `markush1986@gmail.com` gilt seit 2026-04-22 als hart privilegierter Sonderfall fuer Sichtbarkeit, Support- und Admin-Funktionen und darf nicht versehentlich an normalen Premium- oder Rollenregeln scheitern.
- Admin kann Mail-Templates fuer `family_invite`, `premium_invite` und `weekly_plan_ready` direkt in der App pflegen; die Vorlagen werden in `mail_templates` gespeichert und zur Laufzeit mit festen Platzhaltern wie `{{family_name}}`, `{{invite_link}}`, `{{week_start}}`, `{{plan_url}}`, `{{app_url}}` und `{{support_email}}` gerendert.
- Test-Deployments aktivieren Mail jetzt standardmaessig ueber `EMAIL_ENABLED=true` und `EMAIL_PROVIDER=resend`; fuer echte Zustellung werden weiterhin ein gueltiger `RESEND_API_KEY` und eine bei Resend verifizierte Sender-Domain fuer `markushartmann.dev` benoetigt.
- Seit 2026-04-21 gibt es eine zentrale Architekturseite unter `docs/ARCHITECTURE.md`, die Frontend, API, Postgres, Traefik/Entrypoint, Cloudflare Tunnel, OpenAI, Google OIDC, Resend, Bring, Monitoring, GitOps und Umgebungen zusammenfasst.
- Seit 2026-04-21 ist die Cluster-Security fuer `mealplanner` bis `security.aidun.dev/segmentation=enforced` hochgezogen: Default-Deny fuer Ingress und Egress plus explizite Allow-Policies fuer `entrypoint`, `api`, `frontend`, `postgres`, `cloudflared`, `weekly-plan`, `database-bootstrap`, Monitoring, DNS und benoetigte Internet-Egress-Flows.
- Das frühere Sammel-Secret `api-secrets` ist fachlich aufgeteilt in `mealplanner-api-internal`, `mealplanner-auth-core`, `mealplanner-openai`, `mealplanner-email-provider`, `mealplanner-oidc-google` und `mealplanner-oidc-apple`; nicht-sensitive Laufzeitwerte liegen in `mealplanner-api-config`.
- Seit 2026-04-22 hat Feedback einen echten Admin-Workflow: `feedback_entries` tragen `status`, `resolved_at` und `resolved_by_user_id`; `/api/admin/overview` liefert offene Punkte standardmäßig und optional Archivpunkte über `includeResolved=true`, plus `POST /api/admin/feedback/{id}/resolve` zum sauberen Ausblenden gelöster Punkte.
- Feedback ist seit 2026-04-22 fachlich als echter Support-Workflow zu behandeln: auslesbar, triagierbar, statusfaehig und gemeinsam mit Markus diskutierbar; keine losen Einweg-Feedbackflaechen mehr.
- Die Admin-Oberfläche zeigt offene und gelöste Feedbacks getrennt, Mail-Templates bewusst nur als Plain-Text/HTML-Editor mit Vorschau und kein WYSIWYG; parallel wurden Login-, Header-, Profil- und Mobile-Copy auf `Familienküche`/ruhigere Bedienung nachgezogen.
- Seit 2026-04-22 speichert die Profilseite offene Profil-Aenderungen automatisch mit, bevor ein Login ueber `PUT /api/family/member-links` einem Profilmitglied zugeordnet wird. Das behebt den Fall, dass lokale Mitglieder-Aenderungen im Frontend weiter waren als das im Backend gespeicherte Profil.
- Seit 2026-04-22 ist das neutrale Erstprofil wieder sauber vom echten Familienzustand getrennt: `domain.DefaultProfile()` nutzt nur noch Platzhalter (`Privater Haushalt`, `Person 1`), `domain.IsPlaceholderProfile()` erkennt diesen Zustand, und die Familienübersicht behandelt Placeholder nicht mehr als echte Profilpersonen.
- Seit 2026-04-22 haertet `store.ensurePersonalFamily()` alte Familienzustaende nach: wenn `active_family_id` gesetzt ist, aber der passende `family_members`-Eintrag fuer den User fehlt, wird die Mitgliedschaft automatisch wiederhergestellt. Das verhindert leere Familienkonto-Ansichten bei vorhandener aktiver Familie.
- Onboarding und Familienkonto wurden am 2026-04-22 stärker getrennt: Profilpersonen steuern Portionen und Planungslogik, Login-Zugänge leben separat im Familienkonto, und die Regel `ein Login -> ein aktives Familienkonto` wird in der Oberfläche ausdrücklich erklärt.
- Die Haushaltsoberflaeche wurde am 2026-04-22 produktnäher gezogen: Titel jetzt `Haushalt einrichten`, reduziertere Familienkonto-Copy, keine explizite `Kontoregel` mehr, und neutrale Erstfelder werden aus der Login-Mail abgeleitet (`Haushalt Markus`, `Markus` etc.), bis echte Daten gespeichert sind.
- Der Planner-Workspace wurde am 2026-04-22 kompakter gezogen: Hero ruhiger, Bereichswechsel dichter, mobile Wochentage kleiner und die Bereiche heißen nun sichtbarer `Woche`, `Rezept`, `Einkauf` statt dashboardiger zu wirken.
- Die Login-Seite betont seit 2026-04-22 stärker den Produkteinstieg und weniger Verwaltungslogik; der Text beschreibt den Social Login jetzt klar als reinen Zugangsschutz für einen getrennten Familienbereich.
- Die Backend-API-Dokumentation liegt jetzt unter `docs/API.md` und muss bei Endpunkt-, Payload- oder Auth-Aenderungen mitgezogen werden.
- Seit `bc6188f` laeuft das Phase-A-Rebranding sichtbar auf `Mahlio`: zentrale Brand-Konstanten liegen in `frontend/src/brand.ts` und `backend/api/internal/brand/brand.go`, die Uebergangs-Domain bleibt aber `mealplanner.markushartmann.dev`.
- `docs/BRAND.md` dokumentiert den aktuellen Naming-Stand: `Mahlio` als Phase-A-Primärmarke, `Familienküche` nur noch als Uebergangslabel, `Mealplanner` nur noch als technischer Altname.
- Das Rebranding hat Frontend-Meta-Daten, Logo/Wordmark, Login, Header, Dashboard, Onboarding, Admin, Legal-Copy, Bring-Export-Texte und Mail-Template-Defaults auf `Mahlio` umgestellt; Phase-B-Domainmigration steht noch aus.
- Mail-Template-Bestand wird seit `0010_rebrand_mail_templates` auch fuer bestehende `mail_templates` auf den neuen Markennamen migriert, solange alte Default-Texte noch unveraendert gespeichert sind.
- Fuer die spaetere Domainphase sind `mahlio.app` und `mahlio.io` aktuell als priorisierte Kandidaten vorgemerkt; `mahlio.de` ist bereits aktiv belegt.

## Wichtige Arbeitsregeln

- Fuer Cluster-Sicherheitsbaseline, Segmentierung, SealedSecrets und Secret-Monitoring ist `/Users/markus/repo/clustermanager/docs/security/README.md` die verbindliche Einstiegsstelle.
- `/Users/markus/repo/clustermanager` bleibt die GitOps-Quelle fuer clusterweite Labels, Baseline-NetworkPolicies, Kyverno-Regeln und Security-Monitoring.
- Git-verwaltete Secrets sollen als `SealedSecret` gepflegt werden. Echte `Secret`-Manifeste gehoeren nicht ins Repo, ausser `*.secret.example.yaml`.
- Live-only/generated Secrets muessen ausserhalb von Git bleiben und bei Bedarf mit `security.aidun.dev/management=live-only|generated` dokumentiert werden.
- Der naechste Secret-Auftrag fuer dieses Repo ist die echte SealedSecrets-Migration fuer `mealplanner-api-internal`, `mealplanner-auth-core`, `mealplanner-openai`, `mealplanner-email-provider`, `mealplanner-oidc-google` und `mealplanner-oidc-apple`; `mealplanner-database` darf vorerst generated bleiben.

## Offene Hinweise

- TLS-, SSO- und App-Update-Strategien fuer den Home-Cluster sind in `clustermanager/docs/security/` aktuell bewusst Ideen-Dokumente und keine sofort umzusetzenden Vorgaben.
- `mealplanner-test` bleibt die Spielwiese fuer UI-/Prompt-Debug und schnellere Produktiteration; Production soll diese Debug-Ausgaben nicht erhalten.
