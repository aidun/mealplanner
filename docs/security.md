# Security Runbook

Mealplanner ist ab jetzt als produktive private Familien-App zu behandeln.
Breaking Changes muessen vorab angekuendigt werden.

## Zugang und Datenschutz

- App-Zugriff laeuft ueber Google OIDC und eine Allowlist.
- Login-Daten werden minimiert: dauerhaft gespeichert werden nur Provider und pseudonyme Subject-Hashes.
- E-Mail-Adressen duerfen nicht im Repo, in Dokus oder in Datenbanktabellen gespeichert werden. Fuer Allowlist-Eintraege wird `HMAC-SHA256("email:<lowercase-mail>", SESSION_SECRET)` in `AUTH_ALLOWED_EMAIL_HASHES` hinterlegt.
- Sessions laufen ueber `HttpOnly`, `Secure`, `SameSite=Lax` Cookies. Mutierende API-Requests brauchen `X-CSRF-Token`.
- Der Bring-Export ist nur ueber signierte Links oeffentlich lesbar. Diese Links sind fuer Bring noetig und duerfen nicht hinter Cloudflare Access liegen.

## Betrieb

- Public URL: `https://mealplanner.markushartmann.dev`.
- Cloudflare Tunnel: named tunnel `mealplanner-test`, Connector im Namespace `mealplanner-test`.
- Tunnel-Credentials liegen nur lokal unter `~/.cloudflared/` und im Kubernetes Secret `cloudflared-credentials`.
- Secrets werden nicht committed. Bei Neuaufbau des Namespace muessen `api-secrets`, `mealplanner-database`, `ghcr-pull-secret` und `cloudflared-credentials` vorhanden sein.
- `entrypoint` bleibt fuer LAN/Traefik vorhanden. Der oeffentliche Internetpfad geht ueber Cloudflare Tunnel.

## Security Checks

Vor jedem produktiven Rollout ausfuehren:

```sh
cd backend/api
go vet ./...
go test ./...
govulncheck ./...
gosec ./...

cd ../../frontend
npm ci
npm run test -- --run
npm run build
npm audit --audit-level=moderate

cd ..
kubectl kustomize deploy/test >/tmp/mealplanner-test.yaml
kubectl kustomize deploy/production >/tmp/mealplanner-production.yaml
```

## Pentest-Scope

Erlaubt und regelmaessig:

- Nicht-destruktive Checks gegen Auth-Pfade, CSRF, CORS, Security Header und signierte Bring-Links.
- Dependency- und SAST-Scans.
- Kustomize-Render, Argo-Health, Cloudflare-Tunnel-Health.

Nicht ohne explizite Freigabe:

- Lasttests, Passwort-/Token-Bruteforce, aggressive Scanner, Datenbank-Migrationen mit Datenverlust, Router-/Cloudflare-Regelaenderungen ausserhalb dieser App.

## Bekannte bewusst offene Punkte

- Egress-NetworkPolicies sind noch nicht strikt. Das ist absichtlich nicht in einem produktiven Quick-Hardening umgesetzt, weil DNS, OpenAI und Cloudflare-Tunnel sonst leicht gebrochen werden koennen. Naechster Schritt: Egress-Policy mit expliziten DNS- und HTTPS-Ausnahmen in einem separaten Change.
- Bring-Export-Tokens sind statische HMAC-Links pro Plan. Fuer v2 sollte ein expirierendes Tokenformat eingefuehrt werden, ohne bestehende Links sofort zu brechen.
