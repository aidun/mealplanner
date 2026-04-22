# Security Runbook

Mahlio ist ab jetzt als produktive private Familien-App zu behandeln. `mealplanner.markushartmann.dev` bleibt dabei zunaechst die Phase-A-Übergangsadresse.
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
- Secrets werden nicht committed. Bei Neuaufbau des Namespace muessen `mealplanner-database`, `mealplanner-api-internal`, `mealplanner-auth-core`, `mealplanner-openai`, `mealplanner-email-provider`, `mealplanner-oidc-google`, `mealplanner-oidc-apple`, `ghcr-pull-secret` und `cloudflared-credentials` vorhanden sein.
- `entrypoint` bleibt fuer LAN/Traefik vorhanden. Der oeffentliche Internetpfad geht ueber Cloudflare Tunnel.
- GitHub Actions ist ein Pflicht-Gate. Wenn Jobs ohne Runner/Steps fehlschlagen, zuerst GitHub Billing/Spending-Limit pruefen; das ist ein Infrastrukturblocker, kein Code-Gate.

## Cluster Security Status

### Segmentierung

- Der Namespace wird auf `security.aidun.dev/segmentation=enforced` gehalten.
- Workloads tragen `security.aidun.dev/owner=mealplanner`.
- Baseline-NetworkPolicies tragen `security.aidun.dev/baseline=true`.
- Phase 2 fuehrt Namespace-weites Default-Deny fuer Ingress und Egress ein.
- Erlaubt bleiben nur die expliziten Flows fuer `entrypoint`, `api`, `frontend`, `postgres`, `cloudflared`, `weekly-plan`, `database-bootstrap`, DNS, Monitoring und benoetigte Internet-Egress-Pfade.

### Secret-Klassifizierung

Aktueller Zielzustand fuer `mealplanner-test` und spaeter `mealplanner`:

| Secret | Klasse | Begruendung |
| --- | --- | --- |
| `mealplanner-database` | `generated` | wird im Namespace initial erzeugt und enthaelt lokale DB-Zugangsdaten |
| `mealplanner-api-internal` | `live-only` | internes API-Secret fuer CronJob und interne Endpunkte |
| `mealplanner-auth-core` | `live-only` | Session-Secret und Allowlist-Hashes |
| `mealplanner-openai` | `live-only` | OpenAI-Credential |
| `mealplanner-email-provider` | `live-only` | Mail-Provider-Credential |
| `mealplanner-oidc-google` | `live-only` | Google-OIDC-Client-Secret |
| `mealplanner-oidc-apple` | `live-only` | Apple-OIDC-Private-Key |
| `ghcr-pull-secret` | `live-only` | Registry-Zugang ausserhalb von Git |
| `entrypoint-secrets` | `live-only` | Edge-/DNS-Credentials fuer Traefik |
| `cloudflared-credentials` | `live-only` | Tunnel-Credentials aus Cloudflare |

- Diese Secrets muessen im Cluster mit `security.aidun.dev/management=*` und `security.aidun.dev/owner=mealplanner` markiert sein.
- Das Bootstrap-Script labelt die von ihm erzeugten oder vorgefundenen App-Secrets entsprechend nach.
- Nicht-sensitive Laufzeitwerte liegen in der ConfigMap `mealplanner-api-config`.
- Eine spaetere Migration der verbleibenden `live-only`-Secrets auf `SealedSecret` bleibt moeglich, ist aber nicht Teil des aktuellen Schritts.

## Erlaubte Netzwerkfluesse ab Phase 2

- Ingress von beliebigen Quellen nur auf `entrypoint` Ports `8000` und `8443`
- `entrypoint` -> `api:3001`
- `entrypoint` -> `frontend:80`
- `weekly-plan` -> `api:3001`
- `api` -> `postgres:5432`
- `monitoring` -> `api:3001`
- `monitoring` -> `cloudflared:2000`
- `api`, `entrypoint`, `cloudflared`, `weekly-plan`, `database-bootstrap` -> DNS (`kube-dns:53`)
- `api` -> Internet `443/tcp` fuer OpenAI, Google OIDC, Resend und spaetere Apple-Flows
- `entrypoint` -> Internet `443/tcp` fuer ACME/DNS-Challenge
- `cloudflared` -> `entrypoint:8443`
- `cloudflared` -> Internet `443/tcp`, `7844/tcp`, `7844/udp`
- `database-bootstrap` -> Kubernetes API ueber `443/tcp` und `6443/tcp`

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

- Die aktuelle Egress-Policy ist technisch strikt, arbeitet fuer Internet-Ziele aber bewusst mit portbasierten Allow-Listen (`443`, `7844`) statt mit domain-spezifischer Steuerung. Der naechste Reifegrad waere ein sauber dokumentierter Egress-Gateway- oder FQDN-Ansatz.
- Bring-Export-Tokens sind statische HMAC-Links pro Plan. Fuer v2 sollte ein expirierendes Tokenformat eingefuehrt werden, ohne bestehende Links sofort zu brechen.
- Der LAN-LoadBalancer auf dem `entrypoint` ist ein zweiter Origin-Zugang neben Cloudflare Tunnel. Ein Wechsel auf `ClusterIP` wuerde den direkten LAN-Zugang entfernen und ist deshalb ein angekuendigtes Breaking Change.
- Datenschutz und Impressum enthalten technische Platzhalter. Fuer produktive externe Nutzung fehlen echte Betreiberangaben und rechtlich gepruefte Texte.
