# Security Runbook

Mealplanner ist ab jetzt als produktive private Familien-App zu behandeln.
Breaking Changes muessen vorab angekuendigt werden.

## Zugang und Datenschutz

- App-Zugriff laeuft ueber Google OIDC und eine Allowlist.
- Login-Daten werden minimiert: dauerhaft gespeichert werden nur Provider und pseudonyme Subject-Hashes.
- E-Mail-Adressen duerfen nicht im Repo, in Dokus oder in Datenbanktabellen gespeichert werden. Fuer Allowlist-Eintraege wird `HMAC-SHA256("email:<lowercase-mail>", SESSION_SECRET)` in `AUTH_ALLOWED_EMAIL_HASHES` hinterlegt. E-Mail-Allowlisting akzeptiert nur Google-ID-Tokens mit verifizierter E-Mail.
- Sessions laufen ueber `HttpOnly`, `Secure`, `SameSite=Lax` Cookies. Mutierende API-Requests brauchen `X-CSRF-Token`.
- OpenAI-Prompts muessen minimiert bleiben: keine Haushaltsnamen, keine Personennamen, keine Login-Daten, keine vollstaendige Wochen-Einkaufsliste.
- Der Bring-Export ist nur ueber signierte Links oeffentlich lesbar. Diese Links sind fuer Bring noetig und duerfen nicht hinter Cloudflare Access liegen.

## Betrieb

- Public URL: `https://mealplanner.markushartmann.dev`.
- Cloudflare Tunnel: named tunnel `mealplanner-test`, Connector im Namespace `mealplanner-test`.
- Tunnel-Credentials liegen nur lokal unter `~/.cloudflared/` und im Kubernetes Secret `cloudflared-credentials`.
- Secrets werden nicht committed. Bei Neuaufbau des Namespace muessen `api-secrets`, `mealplanner-database`, `ghcr-pull-secret` und `cloudflared-credentials` vorhanden sein.
- `entrypoint` bleibt fuer LAN/Traefik vorhanden. Der oeffentliche Internetpfad geht ueber Cloudflare Tunnel.
- GitHub Actions ist ein Pflicht-Gate. Wenn Jobs ohne Runner/Steps fehlschlagen, zuerst GitHub Billing/Spending-Limit pruefen; das ist ein Infrastrukturblocker, kein Code-Gate.

## Cluster Security Status

### Segmentierung

- Der Namespace wird auf `security.aidun.dev/segmentation=planned` gehalten.
- Workloads tragen `security.aidun.dev/owner=mealplanner`.
- Baseline-NetworkPolicies tragen `security.aidun.dev/baseline=true`.
- Aktuell sind nur explizite Ingress-Flows abgesichert. Namespace-weites Default-Deny und Egress-Allowlisting folgen in einem separaten Change, damit DNS, OpenAI, Google OIDC, Resend, Bring, Cloudflare Tunnel und Monitoring nicht unbeabsichtigt brechen.

### Secret-Klassifizierung

Aktueller Zielzustand fuer `mealplanner-test` und spaeter `mealplanner`:

| Secret | Klasse | Begruendung |
| --- | --- | --- |
| `api-secrets` | `live-only` | Phase-1-Sammel-Secret mit gemischten Laufzeitwerten und Fremd-Credentials |
| `mealplanner-database` | `generated` | wird im Namespace initial erzeugt und enthaelt lokale DB-Zugangsdaten |
| `ghcr-pull-secret` | `live-only` | Registry-Zugang ausserhalb von Git |
| `entrypoint-secrets` | `live-only` | Edge-/DNS-Credentials fuer Traefik |
| `cloudflared-credentials` | `live-only` | Tunnel-Credentials aus Cloudflare |

- Diese Secrets muessen im Cluster mit `security.aidun.dev/management=*` und `security.aidun.dev/owner=mealplanner` markiert sein.
- `api-secrets` traegt in Phase 1 zusaetzlich `security.aidun.dev/secret-exception=true`, weil das Objekt noch nicht sauber nach Management-Klassen getrennt ist.
- Das Bootstrap-Script labelt die von ihm erzeugten oder vorgefundenen App-Secrets entsprechend nach.
- Eine spaetere Migration auf `SealedSecret` bleibt moeglich, ist aber nicht Teil des aktuellen Schritts.

#### Phase-1-Ausnahme `api-secrets`

`api-secrets` bleibt vorerst ein Sammel-Secret. Fuer die Betriebsdokumentation gilt:

- klar `live-only`:
  - `OPENAI_API_KEY`
  - `RESEND_API_KEY`
  - `GOOGLE_CLIENT_SECRET`
  - `APPLE_PRIVATE_KEY`
- sicherheitsrelevante Laufzeit-Secrets:
  - `SESSION_SECRET`
  - `API_SECRET`
  - `AUTH_ALLOWED_SUBJECT_HASHES`
  - `AUTH_ALLOWED_EMAIL_HASHES`
- Konfigurationswerte ohne eigentlichen Secret-Charakter:
  - `AUTH_BASE_URL`
  - `EMAIL_ENABLED`
  - `EMAIL_PROVIDER`
  - `EMAIL_FROM`
  - `EMAIL_REPLY_TO`
  - `GOOGLE_CLIENT_ID`
  - `APPLE_CLIENT_ID`
  - `APPLE_TEAM_ID`
  - `APPLE_KEY_ID`

### Betriebsgrenze von Phase 1

- Phase 1 schafft Sichtbarkeit und Klassifizierung, aber noch keine vollstaendige erzwungene Segmentierung.
- Solange `security.aidun.dev/segmentation=planned` gilt, ist der Namespace gehaertet, aber nicht im Zielbild der Cluster-Baseline angekommen.

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
- Der LAN-LoadBalancer auf dem `entrypoint` ist ein zweiter Origin-Zugang neben Cloudflare Tunnel. Ein Wechsel auf `ClusterIP` wuerde den direkten LAN-Zugang entfernen und ist deshalb ein angekuendigtes Breaking Change.
- Datenschutz und Impressum enthalten technische Platzhalter. Fuer produktive externe Nutzung fehlen echte Betreiberangaben und rechtlich gepruefte Texte.
