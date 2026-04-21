# Production Readiness

Letzter technischer Stand:

- `APP_ENV=production` validiert jetzt kritische Konfiguration beim API-Start.
- Prompt-Debug ist nur aktiv, wenn `APP_ENV=test` und `PROMPT_DEBUG=true`.
- Production nutzt PodDisruptionBudgets fuer `api` und `frontend`.
- Test-Builds des Frontends koennen Prompt-Debug explizit aktivieren; Production-Builds bleiben ohne Debug.

## Pflichtangaben vor Production

Diese Werte muessen fuer einen echten Production-Rollout gesetzt und geprueft sein:

- `AUTH_BASE_URL` mit `https://...`
- `SESSION_SECRET` mit mindestens 32 Zeichen
- `CORS_ORIGINS` nur mit `https://` Origins
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- mindestens eine Allowlist:
  - `AUTH_ALLOWED_SUBJECT_HASHES`
  - oder `AUTH_ALLOWED_EMAIL_HASHES`
- `OPENAI_API_KEY`, falls `PROVIDER_MODE=live`

## Secret-Management fuer Production

Vor Production muss die Secret-Klassifizierung fachlich klar sein:

- `mealplanner-database`: `generated`
- `ghcr-pull-secret`: `live-only`
- `entrypoint-secrets`: `live-only`
- `cloudflared-credentials`: `live-only`
- `api-secrets`: dokumentierte Phase-1-Ausnahme mit `secret-exception=true`, bis das Sammel-Secret spaeter getrennt wird

Die Details und die key-genaue Einordnung von `api-secrets` stehen in [security.md](/Users/markus/repo/mealplanner/docs/security.md).

## Rechtliche Angaben im Frontend

Die Legal-Seiten lesen optional diese Build-Variablen:

- `VITE_LEGAL_OPERATOR_NAME`
- `VITE_LEGAL_OPERATOR_ADDRESS`
- `VITE_LEGAL_CONTACT_EMAIL`
- `VITE_LEGAL_HOSTING`

Ohne diese Angaben bleiben die Seiten technisch erreichbar, aber nicht rechtsfinal.

## Manueller Abnahme-Check

Vor Production einmal Ende-zu-Ende pruefen:

1. Login mit erlaubtem Google-Account
2. Profil speichern
3. Wochenplan erzeugen
4. Mahlzeit regenerieren
5. Bring-Link fuer Woche, Tag und Rezept
6. Familien-Einladung erstellen und annehmen
7. Prompt-Debug nur in Test sichtbar, nie in Production
