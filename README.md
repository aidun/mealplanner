# Mealplanner

Private Familien-Webapp fuer Wochen-Essensplaene. Der aktuelle produktive Zugang laeuft ueber
`https://mealplanner.markushartmann.dev`.

## Architektur

- `backend/api`: Go API mit Postgres, Migrationen und Provider-Abstraktion fuer Mock/OpenAI.
- `frontend`: React/Vite UI im Premium-Food-App-Stil.
- `deploy`: Kustomize-Manifeste fuer Test/Production, Cloudflare Tunnel und ArgoCD.
- `docs/security.md`: Security-, Pentest- und Betriebs-Runbook.

## Lokal starten

Backend erwartet Postgres und nutzt standardmaessig Mock-Generierung:

```sh
cd backend/api
DATABASE_URL='postgres://mealplanner:mealplanner@127.0.0.1:5432/mealplanner_test?sslmode=disable' go run ./cmd/migrate up
DATABASE_URL='postgres://mealplanner:mealplanner@127.0.0.1:5432/mealplanner_test?sslmode=disable' go run ./cmd/api
```

Frontend:

```sh
cd frontend
npm ci
npm run dev
```

Social Login benoetigt eine HTTPS-`AUTH_BASE_URL`, Google OAuth Credentials und Allowlist-Hashes.
Klartext-E-Mail-Adressen gehoeren nicht in Repo oder Datenbank.

## Cluster

Der Test-Overlay nutzt weiterhin `192.168.2.204` im LAN und zusaetzlich Cloudflare Tunnel fuer
`mealplanner.markushartmann.dev`. `PROVIDER_MODE=live` startet nur sauber, wenn
`api-secrets.OPENAI_API_KEY` auf einen echten Wert gesetzt ist. Platzhalter wie
`__set_openai_api_key__` werden vom Backend abgelehnt.

Fuer Segmentierung, SealedSecrets, Secret-Monitoring und die zugehoerigen Cluster-Konventionen
ist `/Users/markus/repo/clustermanager/docs/security/README.md` die verbindliche Einstiegsstelle.
Dieses Repo beschreibt die App, nicht die clusterweite Security-Baseline.

## Qualitaets-Gates

```sh
cd backend/api
go vet ./...
go test ./...
govulncheck ./...
gosec ./...

cd ../../frontend
npm run test -- --run
npm run build
npm audit --audit-level=moderate

cd ..
kubectl kustomize deploy/test
kubectl kustomize deploy/production
```
