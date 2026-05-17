# Beitragen zu Mahlio

Danke, dass du zu Mahlio beitragen möchtest! Diese Richtlinien helfen uns, den Code sauber und die Entwicklung reproduzierbar zu halten.

## Workflow

1. **Fork** das Repository auf deinen Account.
2. **Branch** erstellen: `git checkout -b feat/deine-feature` oder `git checkout -b fix/dein-bugfix`
   - Nutze `feat/` für neue Features
   - Nutze `fix/` für Bugfixes
3. **Entwickeln** und committen (siehe Commit-Konventionen unten)
4. **Tests** schreiben und ausführen (Backend: `go test ./...`, Frontend: `npm test`)
5. **Push** deinen Branch und erstelle einen **Pull Request**
6. Wir reviewen und mergen — danke!

## Commit-Konventionen

Nutze [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

type: feat, fix, docs, style, refactor, test, chore, perf
scope: (optional) bereich — e.g. api, ui, cli
description: kurz und prägnant (imperative mood)
```

Beispiele:
- `feat(api): add meal scheduling endpoint`
- `fix(ui): correct button alignment on mobile`
- `test(api): add integration tests for auth`

## Tests sind Pflicht

Bevor du einen PR öffnest:

**Backend (Go):**
```bash
cd backend/api
go test ./...
go vet ./...
```

**Frontend (React/Vite):**
```bash
cd frontend
npm test
```

Alle Tests müssen bestehen. Nutze `--run` oder `--watch` je nach Bedarf.

## Keine Secrets

Committe **niemals**:
- API-Keys oder Tokens
- Passwörter oder privaten Schlüssel
- `.env`-Dateien mit echten Werten
- AWS-Credentials oder ähnliches

Nutze `.env.example` als Vorlage für notwendige Variablen.

## Fragen?

- Öffne ein Issue für Features oder Bugs
- Diskutiere große Änderungen im Issue bevor du anfängst
- Siehe `docs/ARCHITECTURE.md` für die technische Übersicht
