# Mahlio

KI-gestützter Wochenessensplaner für Familien. Open Source, self-hosted, auf Kubernetes bereit.

Mahlio nutzt ein großes Sprachmodell (LLM), um personalisierte Wochenpläne basierend auf Familienvorlieben, Diäten und Verfügbarkeiten zu erstellen. Alle Daten bleiben unter deiner Kontrolle — auf deinem Server.

---

## Quickstart mit Docker Compose

### Voraussetzungen

- Docker und Docker Compose
- (Optional) OpenAI API-Schlüssel für LLM-Features

### 3 Schritte zum Starten

1. **`.env` erstellen** (von `.env.example` kopieren und anpassen):
   ```bash
   cp .env.example .env
   ```
   Mindestens setzen:
   - `SESSION_SECRET`: Beliebig langer String (z.B. `$(openssl rand -hex 32)`)
   - `API_SECRET`: Beliebig langer String
   - Wenn du OpenAI nutzen möchtest: `OPENAI_API_KEY=sk-...`

2. **Docker Compose starten**:
   ```bash
   docker compose up -d
   ```
   Das startet PostgreSQL, Backend und Frontend.

3. **Browser öffnen**:
   ```
   http://localhost:5173
   ```
   Fertig! Erstelle einen Account und starte mit der Essensplanung.

Weitere Infos: siehe `docker-compose.yml` und `.env.example`.

---

## Konfiguration

Alle Einstellungen laufen über Umgebungsvariablen:

| Variable | Bedeutung | Beispiel |
|----------|-----------|---------|
| `SESSION_SECRET` | Geheim für Session-Cookies | `openssl rand -hex 32` |
| `API_SECRET` | Geheim für JWT/Token-Signierung | `openssl rand -hex 32` |
| `DATABASE_URL` | PostgreSQL-Connection-String | `postgres://user:pass@localhost/mahlio` |
| `PROVIDER_MODE` | `mock` (Test) oder `live` (LLM-Calls) | `mock` (default) |
| `OPENAI_API_KEY` | OpenAI API-Schlüssel (falls `PROVIDER_MODE=live`) | `sk-...` |
| `OPENAI_BASE_URL` | Alternative API-Basis-URL | `https://api.openai.com/v1` (default) |
| `OPENAI_MEAL_MODEL` | LLM-Modell für Essensplanung | `gpt-4o-mini` (default) |
| `CORS_ORIGINS` | Erlaubte Frontend-Origins (komma-separiert) | `http://localhost:5173,https://myapp.com` |

Für die vollständige Liste und Defaults siehe `backend/api/cmd/api/main.go`.

---

## LLM-Provider

Mahlio funktioniert mit jedem OpenAI-API-kompatiblen Provider:

### OpenAI
Standard. `OPENAI_API_KEY` reicht.

### Ollama (lokal)
```bash
# Ollama lokal starten (z.B. auf Port 11434)
ollama serve

# In .env:
OPENAI_BASE_URL=http://host.docker.internal:11434/v1
OPENAI_MEAL_MODEL=llama2
# (bei Docker Desktop; für Linux: IP des Hosts statt host.docker.internal)
```

### Groq
Kostenlos, schnell. `OPENAI_API_KEY` auf einen Groq-Key setzen:
```bash
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=gsk_...
OPENAI_MEAL_MODEL=mixtral-8x7b-32768
```

Jeder OpenAI-API-kompatible Provider funktioniert via `OPENAI_BASE_URL`.

---

## Kubernetes / ArgoCD

Für Production-Deployments nutze **Kustomize** + **ArgoCD**:

### Struktur

- `deploy/base/` — Standard-Konfiguration (Deployment, Service, ConfigMap, Secrets)
- `deploy/argocd/` — ArgoCD Application-Definition
- `deploy/test/` — Test-Overlay mit Test-DB und Dev-Settings
- `deploy/production/` — Production-Overlay (hardened, replicas=2+, resource limits)

### Deploy mit ArgoCD

1. **Application erstellen**:
   ```bash
   kubectl apply -f deploy/argocd/application.yaml
   ```

2. **ArgoCD wird das Manifest synchen**:
   ```bash
   argocd app get mahlio
   argocd app sync mahlio
   ```

Änderungen erfolgen nur über Git-Commits in diesem Repo — kein direktes `kubectl apply`.

Siehe auch `docs/ARCHITECTURE.md` für die volle Cluster-Übersicht.

---

## Bring-Integration

Mahlio kann Essensplaene in **Bring!** (Einkaufslisten-App) exportieren.

### Voraussetzung

Die Export-URL muss vom Mobilgerät erreichbar sein. In lokalen Setups meist ein Problem — nutze ein Reverse-Proxy oder Tunnel:

```bash
# z.B. ngrok oder Cloudflare Tunnel
cloudflare-cli tunnel --url http://localhost:5173
# Dann die öffentliche URL in Bring eintragen
```

In Production: `BRING_WEBHOOK_URL` auf die öffentliche HTTPS-URL setzen.

---

## Entwicklung

Backend:
```bash
cd backend/api
DATABASE_URL='postgres://user:pass@localhost/mahlio' go run ./cmd/api
```

Frontend:
```bash
cd frontend
npm ci
npm run dev
```

Tests:
```bash
cd backend/api && go test ./... && cd ../../frontend && npm test
```

Siehe `docs/ARCHITECTURE.md` für Service-Übersicht und `docs/API.md` für die Backend-API.

---

## Lizenz

MIT — siehe `LICENSE`.

---

## Beitragen

Wir freuen uns über Bug-Reports und Pull Requests! Siehe `CONTRIBUTING.md` für Richtlinien.
