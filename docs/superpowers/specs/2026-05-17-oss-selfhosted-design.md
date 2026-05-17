# Design: Mahlio — Open Source / Self-Hosted

**Datum:** 2026-05-17  
**Status:** Approved

## Kontext

Mahlio wechselt vom Modell einer public-deployed, verkauften App zu einem vollständig open-source,
self-hosted Projekt. Kein öffentliches Deployment, kein SaaS-Modell, keine Monetarisierung.
Nutzer deployen die App selbst auf eigenem Kubernetes.

---

## Was fliegt raus

### Auth: Google OIDC + Apple Sign-In

- Kompletter OAuth-Flow (Google, Apple) wird entfernt
- `internal/auth`: OAuth-spezifischer Code gelöscht
- Zugehörige Secrets: `mealplanner-oidc-google`, `mealplanner-oidc-apple` entfallen
- Frontend: Login-Screen wird zu Username/Passwort-Formular

### Premium-System

- Tabellen: `premium_users` — Drop-Migration
- Code: alle Handler, Repo-Methoden und Domain-Typen rund um Premium und Premium-Einladungen entfernt
- Admin-Bereich: Premium-Sektion entfernt; restlicher Admin (Feedback, Debug) bleibt

### Mailer / E-Mail

- `internal/mailer`: Resend-Provider entfernt; Paket fällt vollständig weg
- Tabellen: `mail_templates` — Drop-Migration
- CronJob `weekly-plan` (Wochenplan-Mail): entfernt
- Familien-Einladungen funktionieren weiterhin über Link-Sharing, kein E-Mail-Versand
- Secrets: `mealplanner-email-provider` entfällt

### Cloudflare Tunnel

- `cloudflared` Deployment, ConfigMap, Service, ServiceMonitor entfernt
- Kein `mealplanner-cloudflare-tunnel` Secret mehr

### Persönliche Domains und IPs

Alle hardcodierten persönlichen Werte werden entfernt oder durch Env-Vars ersetzt:

| Heute | Ersatz |
|---|---|
| `mealplanner.markushartmann.dev` | `APP_BASE_URL` (Env-Var) |
| `info@markushartmann.dev` | entfällt (Mail weg) |
| `192.168.2.204` | entfällt (kein Test-Overlay mehr) |
| `markush1986@gmail.com` | entfällt (Reset-Script weg) |

### Test/Production-Split

- `deploy/test/` entfernt
- `deploy/production/` entfernt
- `scripts/reset-test-first-login.sh` entfernt
- Nur noch ein Deployment-Layer: `deploy/base/` (oder umbenannt zu `deploy/default/`)
- Eine ArgoCD-App-Definition statt zwei
- `APP_ENV=test` / `APP_ENV=production` entfällt; `PROMPT_DEBUG` bleibt als optionale Var

---

## Was kommt rein / wird geändert

### Auth: Username + Passwort

- `internal/auth`: neues Register- und Login-Flow mit bcrypt-Passwort-Hash
- Neue API-Endpunkte: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- Session-Erzeugung und -Verwaltung bleibt identisch (HttpOnly, CSRF, SameSite=Lax)
- Erster registrierter User erhält automatisch Admin-Rolle
- Kein E-Mail-Verify-Flow (Self-Hosted: Vertrauen durch Netzwerkzugang)
- Frontend: Login-Screen und Register-Screen mit Username/Passwort-Feldern

### LLM-Provider: Konfigurierbarer Endpunkt

- `OPENAI_BASE_URL` aus Config lesen (Default: `https://api.openai.com`)
- `OPENAI_API_KEY` bleibt Pflicht wenn `PROVIDER_MODE=live`
- Kompatibel mit Ollama (`http://ollama:11434`), LM Studio, Groq, Mistral etc. ohne zusätzlichen Provider-Code
- Mock-Provider bleibt für lokale Entwicklung ohne LLM

### Deployment: Ein Layer, docker-compose

- `deploy/base/` bleibt als generisches Kustomize-Beispiel; persönliche Werte entfernt
- Neu: `docker-compose.yml` im Repo-Root für lokalen Einstieg ohne Kubernetes
- Beispiel-`.env.example` mit allen konfigurierbaren Variablen dokumentiert

### OSS-Hygiene

- `LICENSE` (MIT)
- `CONTRIBUTING.md`
- `README.md` neu: Self-Hosted-Fokus, Quickstart mit docker-compose, Kubernetes-Abschnitt

### DB-Migrationen

- Drop-Migration für `premium_users`
- Drop-Migration für `mail_templates`

---

## Was bleibt unverändert

- Kern-Features: Wochenplan, Familie, Favoriten, Profil, Bring-Export, Feedback
- PostgreSQL + bestehende Migrationen
- Session-Sicherheitsmodell (HttpOnly, CSRF, SameSite)
- Prometheus-Metriken + ServiceMonitor
- Frontend (React/Vite) — außer Login-Screen und Premium-UI-Elementen
- ArgoCD-Unterstützung (eine App-Definition)
- GitHub Actions CI

---

## Betroffene Dateien (Übersicht)

### Backend

- `internal/auth/auth.go` — OAuth-Code raus, Password-Auth rein
- `internal/httpapi/auth.go` — OAuth-Handler raus, Register/Login-Handler rein
- `internal/httpapi/handler.go` — Premium-Routes raus
- `internal/mailer/` — Paket entfernt
- `internal/domain/types.go` — PremiumUser, PremiumInvite, AdminOverview bereinigt
- `internal/store/store.go` — Premium-Methoden entfernt
- `cmd/api/main.go` — Mailer-Init entfernt, LLM-BaseURL aus Config
- `db/migrations/` — Drop-Migrationen für premium_users, mail_templates

### Deploy

- `deploy/base/cloudflared-*.yaml` — entfernt
- `deploy/base/weekly-plan-cronjob.yaml` — entfernt
- `deploy/base/database-bootstrap-script-configmap.yaml` — persönliche Werte entfernt
- `deploy/test/` — entfernt
- `deploy/production/` — entfernt
- `deploy/argocd/` — auf eine App-Definition reduziert
- Neu: `docker-compose.yml`, `.env.example`

### Frontend

- Login-Screen: OAuth-Buttons → Username/Passwort-Form
- Premium-UI-Elemente: entfernt
- Admin-Bereich: Premium-Sektion entfernt

### Repo-Root

- Neu: `LICENSE`, `CONTRIBUTING.md`
- Geändert: `README.md`
- Entfernt: `scripts/reset-test-first-login.sh`

---

## Bring-Integration

Bleibt unverändert. Signierung läuft über lokales `API_SECRET` (HMAC), kein externer Dienst.
Die Export-URL wird aus `APP_BASE_URL` gebaut — bereits konfigurierbar.

**Vorbehalt:** Die Bring-App muss die Export-URL vom Mobilgerät aus erreichen können.
Bei rein lokalem LAN-Deployment ohne öffentliche URL ist das ein Netzwerk-Problem des Nutzers,
kein Code-Problem. Im README dokumentieren.

---

## Nicht im Scope

- Helm Chart (kann später als separates Projekt folgen)
- Multi-Tenancy / Mandantenfähigkeit
- Generic OIDC als zusätzliche Auth-Option
- UI-Redesign
