# Mealplanner

Private Familien-Webapp fuer Wochen-Essensplaene.

## Architektur

- `backend/api`: Go API mit Postgres, Migrationen und Provider-Abstraktion fuer Mock/OpenAI.
- `frontend`: React/Vite UI im Premium-Food-App-Stil.
- `deploy`: Kustomize-Manifeste fuer Test/Production und ArgoCD.

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

Wenn `API_SECRET` gesetzt ist, sendet das Frontend `VITE_API_SECRET` oder den im Browser gespeicherten Wert `localStorage["mealplanner.apiSecret"]` als `X-API-Secret`.

## Cluster

Der Test-Overlay nutzt `192.168.2.204` und `PROVIDER_MODE=live`. Der Pod startet nur sauber, wenn `api-secrets.OPENAI_API_KEY` auf einen echten Wert gesetzt ist. Platzhalter wie `__set_openai_api_key__` werden vom Backend abgelehnt.

