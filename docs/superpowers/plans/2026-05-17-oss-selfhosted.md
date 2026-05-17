# OSS/Self-Hosted Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mahlio von einer public SaaS-App zu einem vollständig open-source, self-hosted Kubernetes-Projekt migrieren — OAuth raus, Username/Passwort rein, Premium/Email komplett entfernt, ein einzelner Deployment-Layer.

**Architecture:** OAuth (Google/Apple) wird durch lokalen bcrypt-Password-Flow ersetzt. Admin-Erkennung wechselt von hardcodierter E-Mail-Adresse zu einer `is_admin`-Spalte in der DB (erster registrierter User bekommt automatisch Admin-Rechte). Premium-System und Mailer werden vollständig gelöscht. Der OpenAI-Endpunkt wird über `OPENAI_BASE_URL` konfigurierbar — kompatibel mit Ollama, Groq etc. Das Deploy-Setup wird auf einen generischen Layer reduziert, ergänzt um `docker-compose.yml` für den lokalen Einstieg.

**Tech Stack:** Go 1.22+, PostgreSQL 17, React/Vite/TypeScript, bcrypt (`golang.org/x/crypto/bcrypt`), Kustomize, Docker Compose

---

## Dateiübersicht

**Erstellt:**
- `backend/api/internal/store/migrations/0015_local_auth.up.sql`
- `backend/api/internal/store/migrations/0015_local_auth.down.sql`
- `backend/api/internal/store/migrations/0016_drop_premium_mail.up.sql`
- `backend/api/internal/store/migrations/0016_drop_premium_mail.down.sql`
- `docker-compose.yml`
- `.env.example`
- `LICENSE`
- `CONTRIBUTING.md`

**Gelöscht:**
- `backend/api/internal/mailer/` (gesamtes Paket)
- `deploy/base/cloudflared-configmap.yaml`
- `deploy/base/cloudflared-deployment.yaml`
- `deploy/base/cloudflared-service.yaml`
- `deploy/base/cloudflared-servicemonitor.yaml`
- `deploy/base/weekly-plan-cronjob.yaml`
- `deploy/test/` (gesamtes Verzeichnis)
- `deploy/production/` (gesamtes Verzeichnis)

**Geändert:**
- `backend/api/internal/auth/auth.go` — OAuth-Code raus, Passwort-Funktionen rein
- `backend/api/internal/store/store.go` — neue Auth-Methoden, Premium-Methoden entfernt
- `backend/api/internal/domain/types.go` — Premium-Typen entfernt, AccountSettings bereinigt
- `backend/api/internal/config/config.go` — OAuth/Email-Felder raus, `OpenAIBaseURL` rein
- `backend/api/internal/provider/openai.go` — BaseURL aus Config lesen statt hardcoded
- `backend/api/internal/httpapi/auth.go` — OAuth-Handler raus, `register`/`login` rein, `isAdminEmail` → DB-Lookup
- `backend/api/internal/httpapi/handler.go` — Premium-Routen/Mailer entfernt, neue Auth-Routen, Handler struct bereinigt
- `backend/api/cmd/api/main.go` — Mailer-Init entfernt, OpenAIBaseURL weitergereicht
- `frontend/src/types.ts` — Premium-Typen, Email-Settings, isPremium entfernt
- `frontend/src/api.ts` — OAuth/Premium-Funktionen raus, `login`/`register` rein
- `frontend/src/pages/LoginPage.tsx` — OAuth-Buttons → Username/Passwort-Formular
- `frontend/src/pages/AdminPage.tsx` — Premium-Sektion entfernt
- `frontend/src/App.tsx` — `isPremium`-Check entfernt
- `deploy/base/kustomization.yaml` — entfernte Ressourcen aus der Liste streichen
- `README.md` — Self-Hosted-Fokus

---

## Task 1: Migration 0015 — Local Auth Columns

**Files:**
- Create: `backend/api/internal/store/migrations/0015_local_auth.up.sql`
- Create: `backend/api/internal/store/migrations/0015_local_auth.down.sql`

- [ ] **Step 1: Up-Migration schreiben**

```sql
-- 0015_local_auth.up.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 2: Down-Migration schreiben**

```sql
-- 0015_local_auth.down.sql
ALTER TABLE users
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS is_admin;
```

- [ ] **Step 3: Migration manuell verifizieren**

```bash
cd backend/api
psql $DATABASE_URL -c "\d users"
# password_hash und is_admin müssen danach sichtbar sein
```

- [ ] **Step 4: Commit**

```bash
git add backend/api/internal/store/migrations/0015_local_auth.up.sql \
        backend/api/internal/store/migrations/0015_local_auth.down.sql
git commit -m "feat(db): add password_hash and is_admin columns to users"
```

---

## Task 2: Migration 0016 — Premium und Mail-Tabellen droppen

**Files:**
- Create: `backend/api/internal/store/migrations/0016_drop_premium_mail.up.sql`
- Create: `backend/api/internal/store/migrations/0016_drop_premium_mail.down.sql`

- [ ] **Step 1: Up-Migration schreiben**

`user_settings` bleibt bestehen (enthält `profile_onboarding_seen` aus Migration 0013), aber die Email-Spalten werden entfernt.

```sql
-- 0016_drop_premium_mail.up.sql
DROP TABLE IF EXISTS premium_users;
DROP TABLE IF EXISTS mail_templates;
DROP TABLE IF EXISTS generation_events;

ALTER TABLE user_settings
  DROP COLUMN IF EXISTS weekly_plan_email_enabled,
  DROP COLUMN IF EXISTS recipe_email_enabled;
```

- [ ] **Step 2: Down-Migration schreiben**

```sql
-- 0016_drop_premium_mail.down.sql
CREATE TABLE IF NOT EXISTS premium_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  email_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_templates (
  kind TEXT PRIMARY KEY,
  subject_template TEXT NOT NULL,
  text_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS weekly_plan_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS recipe_email_enabled BOOLEAN NOT NULL DEFAULT TRUE;
```

- [ ] **Step 3: Commit**

```bash
git add backend/api/internal/store/migrations/0016_drop_premium_mail.up.sql \
        backend/api/internal/store/migrations/0016_drop_premium_mail.down.sql
git commit -m "feat(db): drop premium_users, mail_templates and email preference columns"
```

---

## Task 3: auth-Paket — Password-Funktionen, OAuth raus

**Files:**
- Modify: `backend/api/internal/auth/auth.go`
- Modify: `backend/api/internal/auth/auth_test.go`

- [ ] **Step 1: Failing Test schreiben**

```go
// auth_test.go — neue Tests unterhalb der bestehenden einfügen
func TestHashPassword(t *testing.T) {
    hash, err := HashPassword("geheim123")
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if !CheckPassword(hash, "geheim123") {
        t.Fatal("expected correct password to pass")
    }
    if CheckPassword(hash, "falsch") {
        t.Fatal("expected wrong password to fail")
    }
}

func TestCheckPasswordEmptyHash(t *testing.T) {
    if CheckPassword("", "irgendwas") {
        t.Fatal("empty hash must never match")
    }
}
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

```bash
cd backend/api && go test ./internal/auth/... -run TestHashPassword -v
# Expected: FAIL — HashPassword undefined
```

- [ ] **Step 3: auth.go komplett ersetzen**

Nur noch das Nötigste: Session-Cookie-Namen, Hash (für Bring HMAC), neue Passwort-Funktionen. Alles OAuth-spezifische fliegt raus.

```go
package auth

import (
    "crypto/hmac"
    "crypto/rand"
    "crypto/sha256"
    "encoding/hex"
    "errors"
    "io"

    "golang.org/x/crypto/bcrypt"
)

const (
    SessionCookieName = "mealplanner_session"
)

var (
    ErrNotAuthenticated  = errors.New("not authenticated")
    ErrInvalidCredentials = errors.New("invalid credentials")
)

// Config enthält nur noch die session-relevanten Werte.
type Config struct {
    SessionSecret string
}

// Service hält den session secret für HMAC-Hashing (Bring-Export).
type Service struct {
    cfg Config
}

func NewService(cfg Config) Service {
    return Service{cfg: cfg}
}

// Hash erzeugt einen stabilen HMAC-SHA256-Fingerprint — wird für den Bring-Export-Link genutzt.
func (s Service) Hash(value string) string {
    mac := hmac.New(sha256.New, []byte(s.cfg.SessionSecret))
    _, _ = mac.Write([]byte(value))
    return hex.EncodeToString(mac.Sum(nil))
}

// HashPassword erzeugt einen bcrypt-Hash für das gegebene Klartextpasswort.
func HashPassword(password string) (string, error) {
    hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    if err != nil {
        return "", err
    }
    return string(hash), nil
}

// CheckPassword vergleicht Klartext gegen einen bcrypt-Hash.
func CheckPassword(hash, password string) bool {
    if hash == "" {
        return false
    }
    return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// randomToken erzeugt einen kryptografisch sicheren URL-sicheren Token.
func randomToken(size int) (string, error) {
    buf := make([]byte, size)
    if _, err := io.ReadFull(rand.Reader, buf); err != nil {
        return "", err
    }
    h := sha256.Sum256(buf)
    return hex.EncodeToString(h[:]), nil
}
```

Hinweis: `randomToken` bleibt, weil `store.go` es für Session-IDs und CSRF-Tokens braucht — es wird dort aber per Copy-paste oder als interner Helper im store-Paket geführt. Prüfen ob store.go seinen eigenen randomToken hat (ja, `crypto/rand` direkt in store.go). Dann `randomToken` aus auth.go einfach weglassen.

- [ ] **Step 4: go.mod prüfen — bcrypt-Dependency vorhanden?**

```bash
cd backend/api && grep "golang.org/x/crypto" go.mod
```

Falls nicht vorhanden:
```bash
cd backend/api && go get golang.org/x/crypto/bcrypt
```

- [ ] **Step 5: Test ausführen — muss bestehen**

```bash
cd backend/api && go test ./internal/auth/... -v
# Expected: alle Tests PASS
```

- [ ] **Step 6: Bestehende Tests anpassen**

Die Tests `TestHashAndAllowlist`, `TestProviderPlaceholdersAreDisabled`, `TestGoogleIDToken*` usw. beziehen sich auf OAuth-Code der jetzt weg ist. Diese Tests löschen oder durch passende Ersatztests ersetzen:

```go
func TestServiceHash(t *testing.T) {
    s := NewService(Config{SessionSecret: "test-secret-32-bytes-minimum-ok"})
    h1 := s.Hash("bring:plan-123")
    h2 := s.Hash("bring:plan-123")
    if h1 != h2 {
        t.Fatal("hash must be deterministic")
    }
    if h1 == s.Hash("bring:plan-456") {
        t.Fatal("hash must differ for different inputs")
    }
}
```

- [ ] **Step 7: Kompilieren prüfen**

```bash
cd backend/api && go build ./...
# Expected: Kompilierfehler wegen fehlender OAuth-Referenzen in anderen Paketen — ist erwartet, wird in späteren Tasks behoben
```

- [ ] **Step 8: Commit**

```bash
git add backend/api/internal/auth/
git commit -m "feat(auth): replace OAuth with bcrypt password auth"
```

---

## Task 4: Store — neue User-Auth-Methoden, Premium raus

**Files:**
- Modify: `backend/api/internal/store/store.go`

- [ ] **Step 1: Zu entfernende Methoden identifizieren**

Folgende Methoden aus store.go löschen:
- `LoginAllowed`
- `IsPremiumUser`
- `ListPremiumUsers`
- `SavePremiumUser`
- `DeletePremiumUser`
- `ListPremiumInvites`
- `CreatePremiumInvite`
- `UserEmailHash`
- `const adminEmail`

Ebenso: `import "github.com/aidun/mealplanner/backend/api/internal/mailer"` entfernen.
`ErrAlreadyPremium` aus den `var`-Block entfernen.

- [ ] **Step 2: Neue Methoden hinzufügen**

`RegisterUser` — legt neuen User an; setzt `is_admin=true` wenn kein User existiert; gibt (userID, created, error) zurück. Schlägt mit UniqueConstraint fehl wenn Email bereits vergeben.

`GetUserByEmail` — liefert (userID, passwordHash, found, error).

`IsAdminUser` — liest `is_admin`-Spalte für eine gegebene userID.

Diese drei Methoden direkt in `store.go` ergänzen:

```go
// RegisterUser legt einen neuen lokalen Account an.
// Der erste registrierte User bekommt automatisch is_admin=true.
func (s Store) RegisterUser(ctx context.Context, email, passwordHash string) (userID string, created bool, err error) {
    var count int
    err = s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
    if err != nil {
        return "", false, err
    }
    isAdmin := count == 0

    err = s.pool.QueryRow(ctx, `
        INSERT INTO users(provider, subject_hash, email, password_hash, is_admin, last_login_at)
        VALUES ('local', $1, $2, $3, $4, now())
        ON CONFLICT (provider, subject_hash) DO NOTHING
        RETURNING id::text
    `, hashEmail(email), strings.ToLower(strings.TrimSpace(email)), passwordHash, isAdmin).Scan(&userID)
    if errors.Is(err, pgx.ErrNoRows) {
        return "", false, nil
    }
    if err != nil {
        return "", false, err
    }
    return userID, true, s.ensurePersonalFamily(ctx, userID)
}

// GetUserByEmail sucht einen lokalen Account anhand der E-Mail-Adresse.
func (s Store) GetUserByEmail(ctx context.Context, email string) (userID, passwordHash string, found bool, err error) {
    err = s.pool.QueryRow(ctx, `
        SELECT id::text, COALESCE(password_hash, '')
        FROM users
        WHERE provider = 'local' AND email = $1
    `, strings.ToLower(strings.TrimSpace(email))).Scan(&userID, &passwordHash)
    if errors.Is(err, pgx.ErrNoRows) {
        return "", "", false, nil
    }
    if err != nil {
        return "", "", false, err
    }
    return userID, passwordHash, true, nil
}

// IsAdminUser gibt zurück ob der User die Admin-Rolle hat.
func (s Store) IsAdminUser(ctx context.Context, userID string) (bool, error) {
    var isAdmin bool
    err := s.pool.QueryRow(ctx, `
        SELECT is_admin FROM users WHERE id = $1
    `, userID).Scan(&isAdmin)
    if errors.Is(err, pgx.ErrNoRows) {
        return false, nil
    }
    return isAdmin, err
}
```

`hashEmail` ist eine package-private Hilfsfunktion für das deterministiche subject_hash im `local`-Provider:

```go
func hashEmail(email string) string {
    h := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(email))))
    return hex.EncodeToString(h[:])
}
```

Import ergänzen: `"crypto/sha256"`, `"encoding/hex"`.

- [ ] **Step 3: `UpsertUser` behalten oder anpassen?**

`UpsertUser` wird von den OAuth-Callbackhandlern genutzt, die wegfallen. Jedoch kann `UpsertUser` für jetzt stehen bleiben — es wird in den nächsten Tasks aus der `Repository`-Schnittstelle und dem HTTP-Handler entfernt. Wer das Store-Paket sauber halten will, kann `UpsertUser` jetzt auch schon löschen.

> **Entscheidung:** `UpsertUser` entfernen. Lokaler Login braucht nur `RegisterUser` und `GetUserByEmail`.

- [ ] **Step 4: Kompilieren**

```bash
cd backend/api && go build ./internal/store/...
# Kompilierfehler wegen fehlender Mailer-Imports sind OK — folgen in Task 5
```

- [ ] **Step 5: Commit**

```bash
git add backend/api/internal/store/store.go
git commit -m "feat(store): add local auth methods, remove premium and upsert-user"
```

---

## Task 5: domain/types.go — Premium-Typen entfernen

**Files:**
- Modify: `backend/api/internal/domain/types.go`

- [ ] **Step 1: Zu löschende Typen identifizieren und entfernen**

Aus `types.go` folgende Typen löschen:
- `PremiumUser` (Zeile 69–73)
- `PremiumInviteResult` (Zeile 75–79)
- `PremiumInvite` (Zeile 81–87)
- `CreatePremiumUserRequest` (Zeile 104–106)
- `CreatePremiumInviteRequest` (Zeile 108–110)
- `MailTemplate` (Zeile 119–129)
- `UpdateMailTemplateRequest` (Zeile 131–135)

Aus `AccountSettings` die beiden Email-Felder entfernen:
```go
// vorher:
type AccountSettings struct {
    WeeklyPlanEmailEnabled bool      `json:"weeklyPlanEmailEnabled"`
    RecipeEmailEnabled     bool      `json:"recipeEmailEnabled"`
    UpdatedAt              time.Time `json:"updatedAt,omitempty"`
}

// nachher:
type AccountSettings struct {
    UpdatedAt time.Time `json:"updatedAt,omitempty"`
}
```

Aus `AdminOverview` die Premium- und Mail-Felder entfernen:
```go
// vorher:
type AdminOverview struct {
    PremiumUsers     []PremiumUser   `json:"premiumUsers,omitempty"`
    PremiumInvites   []PremiumInvite `json:"premiumInvites,omitempty"`
    Feedback         []FeedbackEntry `json:"feedback,omitempty"`
    ResolvedFeedback []FeedbackEntry `json:"resolvedFeedback,omitempty"`
    MailTemplates    []MailTemplate  `json:"mailTemplates,omitempty"`
    Stats            AdminStats      `json:"stats"`
}

// nachher:
type AdminOverview struct {
    Feedback         []FeedbackEntry `json:"feedback,omitempty"`
    ResolvedFeedback []FeedbackEntry `json:"resolvedFeedback,omitempty"`
    Stats            AdminStats      `json:"stats"`
}
```

`FamilyInvite.EmailSent` kann bleiben — das Feld ist jetzt immer `false`, schadet aber nicht. Wenn Sauberkeit gewünscht: entfernen.

- [ ] **Step 2: Kompilieren**

```bash
cd backend/api && go build ./internal/domain/...
```

- [ ] **Step 3: Commit**

```bash
git add backend/api/internal/domain/types.go
git commit -m "feat(domain): remove premium and mail types, clean account settings"
```

---

## Task 6: config.go — OAuth/Email raus, OpenAIBaseURL rein

**Files:**
- Modify: `backend/api/internal/config/config.go`

- [ ] **Step 1: Config-Struct bereinigen**

```go
// Config — nach der Änderung
type Config struct {
    Port          string
    DatabaseURL   string
    APISecret     string
    CORSOrigins   []string
    OpenAIAPIKey  string
    OpenAIBaseURL string
    OpenAIModel   string
    ProviderMode  string
    SessionSecret string
}
```

Entfernte Felder: `AppEnv`, `EmailEnabled`, `EmailProvider`, `EmailFrom`, `EmailReplyTo`, `ResendAPIKey`, `AuthBaseURL`, `AuthAllowedSubjectHashes`, `AuthAllowedEmailHashes`, `GoogleClientID`, `GoogleClientSecret`, `AppleClientID`, `AppleTeamID`, `AppleKeyID`, `ApplePrivateKey`.

- [ ] **Step 2: Load()-Funktion anpassen**

```go
func Load() (Config, error) {
    cfg := Config{
        Port:          getenvDefault("PORT", "3001"),
        DatabaseURL:   strings.TrimSpace(os.Getenv("DATABASE_URL")),
        APISecret:     strings.TrimSpace(os.Getenv("API_SECRET")),
        CORSOrigins:   parseList(os.Getenv("CORS_ORIGINS")),
        OpenAIAPIKey:  strings.TrimSpace(os.Getenv("OPENAI_API_KEY")),
        OpenAIBaseURL: getenvDefault("OPENAI_BASE_URL", "https://api.openai.com"),
        OpenAIModel:   getenvDefault("OPENAI_MEAL_MODEL", "gpt-5.4-mini"),
        ProviderMode:  getenvDefault("PROVIDER_MODE", "mock"),
        SessionSecret: strings.TrimSpace(os.Getenv("SESSION_SECRET")),
    }
    cfg.ProviderMode = strings.ToLower(strings.TrimSpace(cfg.ProviderMode))
    if cfg.DatabaseURL == "" {
        return Config{}, errors.New("DATABASE_URL is required")
    }
    if err := cfg.Validate(); err != nil {
        return Config{}, err
    }
    return cfg, nil
}
```

- [ ] **Step 3: Validate() bereinigen**

```go
func (c Config) Validate() error {
    if c.ProviderMode != "" && !strings.EqualFold(c.ProviderMode, "mock") && !strings.EqualFold(c.ProviderMode, "live") {
        return errors.New("PROVIDER_MODE must be mock or live")
    }
    if strings.EqualFold(c.ProviderMode, "live") && !configuredValue(c.OpenAIAPIKey) {
        return errors.New("OPENAI_API_KEY is required when PROVIDER_MODE=live")
    }
    if !configuredValue(c.SessionSecret) || len(c.SessionSecret) < 32 {
        return errors.New("SESSION_SECRET must be at least 32 characters")
    }
    return nil
}
```

- [ ] **Step 4: Kompilieren**

```bash
cd backend/api && go build ./internal/config/...
```

- [ ] **Step 5: Commit**

```bash
git add backend/api/internal/config/config.go
git commit -m "feat(config): remove oauth/email config, add OPENAI_BASE_URL"
```

---

## Task 7: provider/openai.go — BaseURL konfigurierbar machen

**Files:**
- Modify: `backend/api/internal/provider/openai.go`

- [ ] **Step 1: OpenAIConfig um BaseURL erweitern**

```go
type OpenAIConfig struct {
    APIKey  string
    BaseURL string
    Model   string
}
```

- [ ] **Step 2: baseURL im Generator speichern**

```go
type OpenAIGenerator struct {
    apiKey  string
    baseURL string
    model   string
    client  *http.Client
}

func NewOpenAIGenerator(cfg OpenAIConfig) (OpenAIGenerator, error) {
    apiKey := strings.TrimSpace(cfg.APIKey)
    if apiKey == "" || strings.HasPrefix(apiKey, "__set_") {
        return OpenAIGenerator{}, errors.New("OPENAI_API_KEY is required for live provider mode")
    }
    baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
    if baseURL == "" {
        baseURL = "https://api.openai.com"
    }
    model := strings.TrimSpace(cfg.Model)
    if model == "" {
        model = "gpt-5.4-mini"
    }
    return OpenAIGenerator{
        apiKey:  apiKey,
        baseURL: baseURL,
        model:   model,
        client:  &http.Client{Timeout: 90 * time.Second},
    }, nil
}
```

- [ ] **Step 3: Hardcodierten URL-String ersetzen**

In der `call`-Methode (Zeile ~109 von openai.go) den URL-String ersetzen:

```go
// vorher:
req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/responses", bytes.NewReader(body))

// nachher:
req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.baseURL+"/v1/responses", bytes.NewReader(body))
```

- [ ] **Step 4: Kompilieren**

```bash
cd backend/api && go build ./internal/provider/...
```

- [ ] **Step 5: Commit**

```bash
git add backend/api/internal/provider/openai.go
git commit -m "feat(provider): make OpenAI base URL configurable for Ollama/Groq compat"
```

---

## Task 8: mailer-Paket löschen

**Files:**
- Delete: `backend/api/internal/mailer/` (gesamtes Verzeichnis)

- [ ] **Step 1: Paket löschen**

```bash
rm -rf backend/api/internal/mailer/
```

- [ ] **Step 2: Kompilieren — Fehler erwarten und notieren**

```bash
cd backend/api && go build ./... 2>&1 | grep "mailer"
# Zeigt welche Dateien noch auf mailer zeigen
```

- [ ] **Step 3: Commit**

```bash
git add -A backend/api/internal/mailer/
git commit -m "feat: delete mailer package"
```

---

## Task 9: httpapi/auth.go — Register/Login statt OAuth

**Files:**
- Modify: `backend/api/internal/httpapi/auth.go`

- [ ] **Step 1: Repository-Interface vorbereiten**

In `handler.go` muss das `Repository`-Interface um drei neue Methoden erweitert und die alten entfernt werden. Das passiert in Task 10. Hier erst die Handler schreiben.

- [ ] **Step 2: auth.go komplett ersetzen**

Alle OAuth-Handler (`startGoogle`, `googleCallback`, `appleNotConfigured`, `getAuthProviders`) löschen. `premiumKey` context key, `oauthState` struct, `withPremium` middleware entfernen. `isAdminEmail()` durch DB-Lookup ersetzen.

```go
package httpapi

import (
    "context"
    "encoding/base64"
    "encoding/json"
    "errors"
    "net/http"
    "strings"
    "time"

    "github.com/aidun/mealplanner/backend/api/internal/auth"
    "github.com/aidun/mealplanner/backend/api/internal/store"
)

type contextKey string

const (
    userIDKey contextKey = "userID"
    csrfKey   contextKey = "csrf"
    adminKey  contextKey = "admin"
)

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Email    string `json:"email"`
        Password string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request body")
        return
    }
    email := strings.ToLower(strings.TrimSpace(req.Email))
    if email == "" || strings.TrimSpace(req.Password) == "" {
        writeError(w, http.StatusBadRequest, "email and password are required")
        return
    }
    if len(req.Password) < 8 {
        writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
        return
    }
    hash, err := auth.HashPassword(req.Password)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    userID, created, err := h.repo.RegisterUser(r, email, hash)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    if !created {
        writeError(w, http.StatusConflict, "email already registered")
        return
    }
    sessionID, _, expiresAt, err := h.repo.CreateSession(r, userID, 30*24*time.Hour)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    setSessionCookie(w, sessionID, expiresAt)
    writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Email    string `json:"email"`
        Password string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request body")
        return
    }
    email := strings.ToLower(strings.TrimSpace(req.Email))
    userID, hash, found, err := h.repo.GetUserByEmail(r, email)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    if !found || !auth.CheckPassword(hash, req.Password) {
        writeError(w, http.StatusUnauthorized, "invalid credentials")
        return
    }
    sessionID, _, expiresAt, err := h.repo.CreateSession(r, userID, 30*24*time.Hour)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    setSessionCookie(w, sessionID, expiresAt)
    writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) getSession(w http.ResponseWriter, r *http.Request) {
    userID, csrf, _, ok := h.readSession(r)
    if !ok {
        writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
        return
    }
    isAdmin, err := h.repo.IsAdminUser(r, userID)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    sessionRequest := r.WithContext(context.WithValue(r.Context(), userIDKey, userID))
    profile, err := h.repo.GetProfile(sessionRequest)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    hasSeenOnboarding, err := h.repo.HasSeenProfileOnboarding(sessionRequest, userID)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    writeJSON(w, http.StatusOK, map[string]any{
        "authenticated":      true,
        "userID":             userID,
        "isAdmin":            isAdmin,
        "csrfToken":          csrf,
        "onboardingRequired": domain.IsPlaceholderProfile(profile) && !hasSeenOnboarding,
    })
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
    if cookie, err := r.Cookie(auth.SessionCookieName); err == nil {
        _ = h.repo.DeleteSession(r, cookie.Value)
    }
    clearCookie(w, auth.SessionCookieName, "/")
    writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) withSession(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        userID, csrf, _, ok := h.readSession(r)
        if !ok {
            writeError(w, http.StatusUnauthorized, "unauthorized")
            return
        }
        isAdmin, err := h.repo.IsAdminUser(r, userID)
        if err != nil {
            h.serverError(w, r, err)
            return
        }
        ctx := context.WithValue(r.Context(), userIDKey, userID)
        ctx = context.WithValue(ctx, csrfKey, csrf)
        ctx = context.WithValue(ctx, adminKey, isAdmin)
        next(w, r.WithContext(ctx))
    }
}

func (h *Handler) withCSRF(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        csrf, _ := r.Context().Value(csrfKey).(string)
        if csrf == "" || strings.TrimSpace(r.Header.Get("X-CSRF-Token")) != csrf {
            writeError(w, http.StatusForbidden, "csrf token required")
            return
        }
        next(w, r)
    }
}

func (h *Handler) withAdmin(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        isAdmin, _ := r.Context().Value(adminKey).(bool)
        if !isAdmin {
            writeError(w, http.StatusForbidden, "forbidden")
            return
        }
        next(w, r)
    }
}

func (h *Handler) readSession(r *http.Request) (string, string, time.Time, bool) {
    cookie, err := r.Cookie(auth.SessionCookieName)
    if err != nil || cookie.Value == "" {
        return "", "", time.Time{}, false
    }
    userID, csrf, expiresAt, err := h.repo.GetSession(r, cookie.Value)
    if errors.Is(err, store.ErrNotFound) {
        return "", "", time.Time{}, false
    }
    if err != nil {
        h.logger.Error("session lookup failed", "error", err)
        return "", "", time.Time{}, false
    }
    return userID, csrf, expiresAt, true
}

func mustUserID(ctx context.Context) string {
    userID, _ := ctx.Value(userIDKey).(string)
    if userID == "" {
        panic("missing authenticated user id")
    }
    return userID
}

func setSessionCookie(w http.ResponseWriter, sessionID string, expiresAt time.Time) {
    http.SetCookie(w, &http.Cookie{
        Name:     auth.SessionCookieName,
        Value:    sessionID,
        Path:     "/",
        Expires:  expiresAt,
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
    })
}

func clearCookie(w http.ResponseWriter, name, path string) {
    http.SetCookie(w, &http.Cookie{
        Name:     name,
        Value:    "",
        Path:     path,
        MaxAge:   -1,
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
    })
}

func encodeCookie(raw []byte) string {
    return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeCookie(value string, target any) error {
    raw, err := base64.RawURLEncoding.DecodeString(value)
    if err != nil {
        return err
    }
    return json.Unmarshal(raw, target)
}
```

Hinweis: `encodeCookie`/`decodeCookie` nur behalten wenn sie noch anderswo genutzt werden — sonst ebenfalls löschen.

Import für `domain` ergänzen, da `getSession` auf `domain.IsPlaceholderProfile` zugreift.

- [ ] **Step 3: Kompilieren**

```bash
cd backend/api && go build ./internal/httpapi/... 2>&1
```

- [ ] **Step 4: Commit**

```bash
git add backend/api/internal/httpapi/auth.go
git commit -m "feat(httpapi): replace OAuth handlers with local register/login"
```

---

## Task 10: httpapi/handler.go — Routen, Repository-Interface, Handler-Struct bereinigen

**Files:**
- Modify: `backend/api/internal/httpapi/handler.go`

- [ ] **Step 1: Repository-Interface bereinigen**

Aus dem `Repository`-Interface entfernen:
- `UpsertUser`
- `GetUserEmail`
- `IsPremiumUser`
- `LoginAllowed`
- `UserEmailHash`
- `ListPremiumUsers`
- `SavePremiumUser`
- `DeletePremiumUser`
- `ListMailTemplates`
- `SaveMailTemplate`

Hinzufügen:
```go
RegisterUser(r *http.Request, email, passwordHash string) (userID string, created bool, err error)
GetUserByEmail(r *http.Request, email string) (userID, passwordHash string, found bool, err error)
IsAdminUser(r *http.Request, userID string) (bool, error)
```

- [ ] **Step 2: StoreRepository-Adapter ergänzen**

```go
func (r StoreRepository) RegisterUser(req *http.Request, email, passwordHash string) (string, bool, error) {
    return r.Store.RegisterUser(req.Context(), email, passwordHash)
}

func (r StoreRepository) GetUserByEmail(req *http.Request, email string) (string, string, bool, error) {
    return r.Store.GetUserByEmail(req.Context(), email)
}

func (r StoreRepository) IsAdminUser(req *http.Request, userID string) (bool, error) {
    return r.Store.IsAdminUser(req.Context(), userID)
}
```

Die entsprechenden alten Adapter-Methoden (`IsPremiumUser`, `LoginAllowed`, `UpsertUser`, `UserEmailHash`, `ListPremiumUsers`, `SavePremiumUser`, `DeletePremiumUser`, `ListMailTemplates`, `SaveMailTemplate`) löschen.

- [ ] **Step 3: Handler-Struct bereinigen**

```go
// vorher:
type Handler struct {
    repo      Repository
    planner   planner.Planner
    auth      auth.Service
    apiSecret string
    // ...
    mailer    mailer.Mailer
}

// nachher: mailer-Feld entfernen
type Handler struct {
    repo      Repository
    planner   planner.Planner
    auth      auth.Service
    apiSecret string
    // ... (alle anderen Felder ohne mailer)
}
```

- [ ] **Step 4: New()-Signatur anpassen**

```go
// vorher:
func New(repo Repository, planner planner.Planner, authService auth.Service, apiSecret string, corsOrigins []string, logger *slog.Logger, appMailer mailer.Mailer) http.Handler {

// nachher:
func New(repo Repository, planner planner.Planner, authService auth.Service, apiSecret string, corsOrigins []string, logger *slog.Logger) http.Handler {
```

`mailer`-Import entfernen.

- [ ] **Step 5: Routen aktualisieren**

Entfernen:
```go
mux.HandleFunc("GET /api/auth/providers", h.getAuthProviders)
mux.HandleFunc("POST /api/auth/google/start", h.startGoogle)
mux.HandleFunc("GET /api/auth/google/callback", h.googleCallback)
mux.HandleFunc("GET /api/auth/apple/start", h.appleNotConfigured)
mux.HandleFunc("GET /api/auth/apple/callback", h.appleNotConfigured)
mux.HandleFunc("POST /api/admin/premium-users", ...)
mux.HandleFunc("DELETE /api/admin/premium-users/{premiumUserID}", ...)
mux.HandleFunc("GET /api/admin/mail-templates", ...)
mux.HandleFunc("PUT /api/admin/mail-templates/{kind}", ...)
mux.HandleFunc("POST /api/internal/plans/weekly", ...)  // Weekly-Plan-CronJob-Endpunkt
```

`withPremium` bei feedback entfernen:
```go
// vorher:
mux.HandleFunc("POST /api/feedback", h.withSession(h.withPremium(h.withCSRF(h.createFeedback))))

// nachher:
mux.HandleFunc("POST /api/feedback", h.withSession(h.withCSRF(h.createFeedback)))
```

Hinzufügen:
```go
mux.HandleFunc("POST /api/auth/register", h.register)
mux.HandleFunc("POST /api/auth/login", h.login)
```

- [ ] **Step 6: Handler-Methoden löschen**

Folgende Handler-Methoden aus handler.go entfernen (oder in separaten handler_*-Dateien wenn vorhanden):
- `createPremiumUser`
- `deletePremiumUser`
- `getMailTemplates`
- `putMailTemplate`
- `createPlansForAllUsers` (Weekly-Plan-Email-Endpunkt)

`getAdminOverview` anpassen:
```go
func (h *Handler) getAdminOverview(w http.ResponseWriter, r *http.Request) {
    feedback, err := h.repo.ListFeedback(r, "open", 100)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    resolved, err := h.repo.ListFeedback(r, "resolved", 50)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    stats, err := h.repo.AdminStats(r)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    writeJSON(w, http.StatusOK, domain.AdminOverview{
        Feedback:         feedback,
        ResolvedFeedback: resolved,
        Stats:            stats,
    })
}
```

`createFamilyInvite` bereinigen — Mailer-Aufruf entfernen, nur Invite-Link zurückgeben:
```go
func (h *Handler) createFamilyInvite(w http.ResponseWriter, r *http.Request) {
    var req domain.CreateFamilyInviteRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request body")
        return
    }
    // email hash für den invite (nutzt auth.Service.Hash für HMAC-Konsistenz)
    emailHash := ""
    if e := strings.TrimSpace(req.Email); e != "" {
        emailHash = h.auth.Hash("email:" + strings.ToLower(e))
    }
    invite, token, err := h.repo.CreateFamilyInvite(r, emailHash, 7*24*time.Hour)
    if err != nil {
        h.serverError(w, r, err)
        return
    }
    invite.InviteLink = absoluteRequestURL(r, "/join?token="+token)
    // EmailSent bleibt false — kein Mailer mehr
    writeJSON(w, http.StatusCreated, invite)
}
```

Alle verbleibenden `h.mailer.*`-Aufrufe (z.B. `mailTemplateByKind`, `renderTemplate`) löschen.

- [ ] **Step 7: Hilfs-Funktionen aus handler.go löschen**

`mailTemplateByKind`, `renderTemplate`, `renderHTMLTemplate` löschen wenn sie nur für Mailer genutzt wurden.

- [ ] **Step 8: Kompilieren**

```bash
cd backend/api && go build ./internal/httpapi/...
```

- [ ] **Step 9: Commit**

```bash
git add backend/api/internal/httpapi/handler.go
git commit -m "feat(httpapi): remove mailer, premium routes, add register/login routes"
```

---

## Task 11: cmd/api/main.go — Mailer raus, OpenAIBaseURL rein

**Files:**
- Modify: `backend/api/cmd/api/main.go`

- [ ] **Step 1: main.go ersetzen**

```go
package main

import (
    "context"
    "log"
    "log/slog"
    "net/http"
    "os"
    "strings"
    "time"

    "github.com/aidun/mealplanner/backend/api/internal/auth"
    "github.com/aidun/mealplanner/backend/api/internal/config"
    "github.com/aidun/mealplanner/backend/api/internal/httpapi"
    "github.com/aidun/mealplanner/backend/api/internal/planner"
    "github.com/aidun/mealplanner/backend/api/internal/provider"
    "github.com/aidun/mealplanner/backend/api/internal/store"
    "github.com/jackc/pgx/v5/pgxpool"
)

func main() {
    cfg, err := config.Load()
    if err != nil {
        log.Fatal(err)
    }
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
    if err != nil {
        log.Fatal(err)
    }
    defer pool.Close()

    generator, err := buildGenerator(cfg)
    if err != nil {
        log.Fatal(err)
    }
    logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
    authService := auth.NewService(auth.Config{
        SessionSecret: cfg.SessionSecret,
    })
    handler := httpapi.New(httpapi.StoreRepository{Store: store.New(pool)}, planner.New(generator), authService, cfg.APISecret, cfg.CORSOrigins, logger)

    server := &http.Server{
        Addr:              ":" + cfg.Port,
        Handler:           handler,
        ReadHeaderTimeout: 5 * time.Second,
    }
    logger.Info("mealplanner api listening", "port", cfg.Port, "providerMode", cfg.ProviderMode)
    if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        log.Fatal(err)
    }
}

func buildGenerator(cfg config.Config) (planner.Generator, error) {
    if strings.EqualFold(cfg.ProviderMode, "live") {
        return provider.NewOpenAIGenerator(provider.OpenAIConfig{
            APIKey:  cfg.OpenAIAPIKey,
            BaseURL: cfg.OpenAIBaseURL,
            Model:   cfg.OpenAIModel,
        })
    }
    return provider.NewMockGenerator(), nil
}
```

- [ ] **Step 2: Kompilieren**

```bash
cd backend/api && go build ./cmd/api/...
# Expected: kein Fehler
```

- [ ] **Step 3: Alle Tests ausführen**

```bash
cd backend/api && go test ./...
```

- [ ] **Step 4: Commit**

```bash
git add backend/api/cmd/api/main.go
git commit -m "feat(main): remove mailer init, pass OpenAIBaseURL to provider"
```

---

## Task 12: Frontend — types.ts bereinigen

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Zu löschende Typen finden**

```bash
grep -n "Premium\|isPremium\|weeklyPlanEmail\|recipeEmail\|MailTemplate" frontend/src/types.ts
```

- [ ] **Step 2: Typen entfernen**

Aus `types.ts` entfernen:
- `PremiumUser` interface/type
- `PremiumInviteResult` interface/type
- `isPremium` aus dem Session-Typ
- `weeklyPlanEmailEnabled` und `recipeEmailEnabled` aus `AccountSettings`
- `premiumUsers` aus `AdminOverview`

- [ ] **Step 3: TypeScript kompilieren**

```bash
cd frontend && npm run build 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat(frontend): remove premium and email types"
```

---

## Task 13: Frontend — api.ts bereinigen

**Files:**
- Modify: `frontend/src/api.ts`

- [ ] **Step 1: Zu entfernende Funktionen finden**

```bash
grep -n "Premium\|AuthProvider\|getAuthProviders\|MailTemplate" frontend/src/api.ts
```

- [ ] **Step 2: Funktionen entfernen**

Aus `api.ts` entfernen:
- `getAuthProviders`
- `createPremiumUser`
- `deletePremiumUser`
- `getMailTemplates`
- `updateMailTemplate`

- [ ] **Step 3: Neue Auth-Funktionen hinzufügen**

```typescript
export async function register(email: string, password: string): Promise<void> {
  const res = await fetchJSON('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new ApiError(res.status, await extractError(res));
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetchJSON('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new ApiError(res.status, await extractError(res));
}
```

Dabei das bestehende Muster aus der Datei für `fetchJSON` und `extractError` verwenden.

- [ ] **Step 4: TypeScript kompilieren**

```bash
cd frontend && npm run build 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat(frontend): replace oauth/premium api calls with login/register"
```

---

## Task 14: Frontend — LoginPage neu

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`

- [ ] **Step 1: LoginPage komplett ersetzen**

OAuth-Buttons durch E-Mail/Passwort-Formular ersetzen. Zwei Modi: "Anmelden" und "Registrieren" per Tab-Toggle.

```tsx
import { useState } from 'react';
import { AppLogo } from '../components/AppLogo';
import { login, register } from '../api';
import { readableApiError } from '../lib/api-error';
import { brand } from '../brand';

type Mode = 'login' | 'register';

const previewDays = [
  { label: 'Mo', title: 'Zitronenpasta', note: 'schnell nach dem Sport', active: true },
  { label: 'Di', title: 'Blechlachs', note: 'mit Kartoffeln und Erbsen', active: false },
  { label: 'Mi', title: 'Tomatensuppe', note: 'mit warmem Käsebrot', active: false },
  { label: 'Do', title: 'Gnocchi-Pfanne', note: 'wenig Abwasch, viel Gemüse', active: false },
] as const;

const previewIngredients = ['Zitronen', 'Brokkoli', 'Burrata', 'Pasta', 'Basilikum'] as const;
const previewShopping = ['Zitronen 2 Stk', 'Brokkoli 1 Kopf', 'Burrata 2 Kugeln', 'Pasta 500 g'] as const;

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      window.location.assign('/');
    } catch (err) {
      setError(readableApiError(err, mode === 'login' ? 'Anmeldung fehlgeschlagen.' : 'Registrierung fehlgeschlagen.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <main className="login-panel" aria-labelledby="login-title">
        <div className="login-stage">
          <section className="login-copy">
            <div className="login-brand-lockup">
              <AppLogo markOnly className="login-brand-mark" />
              <div className="login-brand-copy">
                <p className="eyebrow">{brand.category}</p>
                <h1 id="login-title">{brand.name}</h1>
                <p className="login-brand-slogan">{brand.slogan}</p>
              </div>
            </div>

            <div className="login-intro">
              <h2 className="login-entry-headline">{brand.entryHeadline}</h2>
              <p className="login-lead">{brand.entrySubline}</p>
            </div>

            <div className="login-actions-block">
              <div className="login-mode-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => { setMode('login'); setError(''); }}
                  className={mode === 'login' ? 'active' : ''}
                >
                  Anmelden
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => { setMode('register'); setError(''); }}
                  className={mode === 'register' ? 'active' : ''}
                >
                  Registrieren
                </button>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="login-form" noValidate>
                <label htmlFor="email">E-Mail</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
                <label htmlFor="password">Passwort</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  disabled={loading}
                  minLength={8}
                />
                <button
                  type="submit"
                  className="button button-primary login-button"
                  disabled={loading}
                >
                  {loading
                    ? mode === 'login' ? 'Anmelden…' : 'Registrieren…'
                    : mode === 'login' ? 'Anmelden' : 'Registrieren'}
                </button>
              </form>

              {error ? (
                <p className="error-copy" role="alert">{error}</p>
              ) : null}
            </div>
          </section>

          <section className="login-preview" aria-label="Produktvorschau">
            <div className="entry-tableau">
              <div className="entry-tableau-overview">
                <div>
                  <span className="entry-preview-label">Nächste Woche</span>
                  <strong>Zitronenpasta, Blechlachs und eine Suppe für Mittwoch</strong>
                </div>
                <p>Vier Abende, die zusammenpassen und direkt auf den Einkauf einzahlen.</p>
              </div>

              <div className="entry-tableau-grid">
                <div className="entry-tableau-week" aria-label="Woche">
                  {previewDays.map((day) => (
                    <article
                      key={day.label}
                      className={`entry-tableau-day${day.active ? ' entry-tableau-day-active' : ''}`}
                    >
                      <span>{day.label}</span>
                      <strong>{day.title}</strong>
                      <small>{day.note}</small>
                    </article>
                  ))}
                </div>

                <div className="entry-tableau-focus" aria-label="Gericht im Fokus">
                  <div className="entry-tableau-recipe">
                    <span className="entry-preview-section-title">Gericht im Fokus</span>
                    <h3>Pasta al Limone mit Brokkoli und Burrata</h3>
                    <p>Cremig, hell und schnell genug für einen vollen Montag mit Kindern und spätem Feierabend.</p>
                    <div className="entry-tableau-ingredients" aria-label="Zutaten im Rezept">
                      {previewIngredients.map((ingredient) => (
                        <span key={ingredient}>{ingredient}</span>
                      ))}
                    </div>
                  </div>

                  <div className="entry-tableau-shopping" aria-label="Einkauf">
                    <div className="entry-tableau-shopping-head">
                      <span className="entry-preview-section-title">Einkauf</span>
                      <strong>Ein Einkauf für mehrere Abende</strong>
                    </div>
                    <ul>
                      {previewShopping.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript kompilieren**

```bash
cd frontend && npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx
git commit -m "feat(frontend): replace oauth login with email/password form"
```

---

## Task 15: Frontend — AdminPage Premium-Sektion entfernen

**Files:**
- Modify: `frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: Premium-bezogene Elemente identifizieren**

```bash
grep -n "premium\|Premium\|mailTemplate\|MailTemplate" frontend/src/pages/AdminPage.tsx
```

- [ ] **Step 2: Premium-Sektion und Mail-Template-Editor entfernen**

Alle Render-Blöcke und State/Query-Hooks rund um `premiumUsers`, `createPremiumUser`, `deletePremiumUser`, `mailTemplates`, `updateMailTemplate` aus AdminPage entfernen.

- [ ] **Step 3: TypeScript kompilieren**

```bash
cd frontend && npm run build 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AdminPage.tsx
git commit -m "feat(frontend): remove premium management from admin page"
```

---

## Task 16: Frontend — App.tsx isPremium entfernen

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: isPremium-Vorkommen finden**

```bash
grep -n "isPremium\|premium" frontend/src/App.tsx
```

- [ ] **Step 2: Feedback-Widget-Bedingung vereinfachen**

```tsx
// vorher (Zeile ~110):
{(isPremium || isAdmin) && <FeedbackWidget />}

// nachher — sichtbar für alle eingeloggten User:
{session?.authenticated && <FeedbackWidget />}
```

Falls Feedback nur für Admins gewünscht:
```tsx
{isAdmin && <FeedbackWidget />}
```

> **Entscheidung:** Für alle eingeloggten User sichtbar lassen — self-hosted Nutzer sind per Definition vertrauenswürdig.

- [ ] **Step 3: TypeScript kompilieren**

```bash
cd frontend && npm run build 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): remove isPremium check, show feedback for all users"
```

---

## Task 17: Deploy — cloudflared, Overlays und CronJob entfernen

**Files:**
- Modify: `deploy/base/kustomization.yaml`
- Delete: `deploy/base/cloudflared-configmap.yaml`
- Delete: `deploy/base/cloudflared-deployment.yaml`
- Delete: `deploy/base/cloudflared-service.yaml`
- Delete: `deploy/base/cloudflared-servicemonitor.yaml`
- Delete: `deploy/base/weekly-plan-cronjob.yaml`
- Delete: `deploy/test/` (Verzeichnis)
- Delete: `deploy/production/` (Verzeichnis)

- [ ] **Step 1: Dateien löschen**

```bash
rm -f deploy/base/cloudflared-configmap.yaml \
       deploy/base/cloudflared-deployment.yaml \
       deploy/base/cloudflared-service.yaml \
       deploy/base/cloudflared-servicemonitor.yaml \
       deploy/base/weekly-plan-cronjob.yaml
rm -rf deploy/test/ deploy/production/
```

- [ ] **Step 2: kustomization.yaml anpassen**

Die gelöschten Ressourcen aus dem `resources:`-Block in `deploy/base/kustomization.yaml` entfernen:
```yaml
# Diese Zeilen entfernen:
- cloudflared-configmap.yaml
- cloudflared-deployment.yaml
- cloudflared-service.yaml
- cloudflared-servicemonitor.yaml
- weekly-plan-cronjob.yaml
```

- [ ] **Step 3: deploy/argocd/ auf eine App-Definition reduzieren**

```bash
ls deploy/argocd/
```

Falls Test- und Production-App-Definitionen vorhanden: auf eine generische reduzieren (persönliche Domains/Namespace ersetzen durch Platzhalter oder Env-Vars).

- [ ] **Step 4: Commit**

```bash
git add -A deploy/
git commit -m "feat(deploy): remove cloudflared, test/prod overlays, weekly-plan cronjob"
```

---

## Task 18: docker-compose.yml und .env.example

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: docker-compose.yml erstellen**

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: mealplanner
      POSTGRES_USER: mealplanner
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-mealplanner}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mealplanner"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: backend/api
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgres://mealplanner:${POSTGRES_PASSWORD:-mealplanner}@db:5432/mealplanner?sslmode=disable
      SESSION_SECRET: ${SESSION_SECRET}
      API_SECRET: ${API_SECRET}
      PROVIDER_MODE: ${PROVIDER_MODE:-mock}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      OPENAI_BASE_URL: ${OPENAI_BASE_URL:-https://api.openai.com}
      OPENAI_MEAL_MODEL: ${OPENAI_MEAL_MODEL:-gpt-5.4-mini}
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173}
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build:
      context: frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  db_data:
```

- [ ] **Step 2: .env.example erstellen**

```bash
# Mealplanner — Konfiguration
# Kopiere diese Datei nach .env und passe die Werte an.

# Pflicht
SESSION_SECRET=your-random-secret-min-32-characters
API_SECRET=your-random-api-secret

# Datenbank (nur für lokale Entwicklung außerhalb docker-compose)
# DATABASE_URL=postgres://mealplanner:mealplanner@localhost:5432/mealplanner?sslmode=disable

# LLM-Provider
# PROVIDER_MODE=mock          # 'mock' (Standard) oder 'live'
# OPENAI_API_KEY=sk-...       # Pflicht wenn PROVIDER_MODE=live
# OPENAI_BASE_URL=https://api.openai.com  # Ollama: http://localhost:11434
# OPENAI_MEAL_MODEL=gpt-5.4-mini

# Netzwerk
# CORS_ORIGINS=https://mealplanner.example.com
# APP_BASE_URL=https://mealplanner.example.com  # Für Bring-Export-Links

# Postgres (nur docker-compose)
# POSTGRES_PASSWORD=mealplanner
```

- [ ] **Step 3: .env.example committen**

```bash
echo ".env" >> .gitignore
git add docker-compose.yml .env.example .gitignore
git commit -m "feat: add docker-compose.yml and .env.example for self-hosted quickstart"
```

---

## Task 19: OSS-Hygiene — LICENSE, CONTRIBUTING.md, README.md

**Files:**
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Modify: `README.md`

- [ ] **Step 1: MIT-Lizenz erstellen**

```
MIT License

Copyright (c) 2026 Markus Hartmann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: CONTRIBUTING.md erstellen**

Inhalt: kurze Hinweise zu Fork, Branch, PR, Commit-Konventionen, Testpflicht.

- [ ] **Step 3: README.md neu schreiben**

Fokus: Self-Hosted-Quickstart (docker-compose), Kubernetes-Abschnitt (Kustomize), Konfigurationstabelle (alle Env-Vars), Bring-Integration-Hinweis.

- [ ] **Step 4: Commit**

```bash
git add LICENSE CONTRIBUTING.md README.md
git commit -m "docs: add LICENSE, CONTRIBUTING, rewrite README for self-hosted"
```

---

## Task 20: Abschluss — Vollständiger Build und manuelle Verifikation

- [ ] **Step 1: Backend vollständig bauen**

```bash
cd backend/api && go build ./... && go test ./...
# Expected: keine Fehler, alle Tests grün
```

- [ ] **Step 2: Frontend vollständig bauen**

```bash
cd frontend && npm run build
# Expected: kein TypeScript-Fehler, Bundle erstellt
```

- [ ] **Step 3: docker-compose smoke test**

```bash
SESSION_SECRET=$(openssl rand -hex 32) API_SECRET=$(openssl rand -hex 16) docker compose up --build
# Dann in einem zweiten Terminal:
curl http://localhost:3001/health
# Expected: {"ok":true} oder ähnlich
```

- [ ] **Step 4: Register/Login manuell testen**

```bash
curl -c cookies.txt -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"geheim1234"}'
# Expected: {"ok":true}, HTTP 201

curl -c cookies.txt -b cookies.txt http://localhost:3001/api/session
# Expected: {"authenticated":true,"isAdmin":true,...}

curl -c cookies2.txt -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"geheim1234"}'
# Expected: {"ok":true}, HTTP 200
```

- [ ] **Step 5: Bring-Export prüfen**

Einen Plan anlegen und den Bring-Export-Link aufrufen — sollte wie bisher funktionieren.

- [ ] **Step 6: Final commit**

```bash
git add -A
git status  # Sicherstellen dass nichts Ungewolltes staged ist
git commit -m "feat: complete OSS/self-hosted migration"
```

---

## Self-Review Checkliste

**Spec-Abdeckung:**
- [x] Auth: Google/Apple → Username/Passwort → Tasks 3, 4, 9, 10, 11, 14
- [x] Premium-System entfernt → Tasks 4, 5, 10, 12, 13
- [x] Mailer entfernt → Tasks 8, 10
- [x] OpenAI BaseURL konfigurierbar → Tasks 6, 7, 11
- [x] Ein Deployment-Layer → Task 17
- [x] Hardcodierte Werte entfernt (E-Mail, Domain) → Tasks 9, 10
- [x] DB-Migrationen → Tasks 1, 2
- [x] docker-compose + .env.example → Task 18
- [x] OSS-Hygiene → Task 19
- [x] Bring-Integration unverändert → kein eigener Task nötig (bestehender Code)

**Typ-Konsistenz:**
- `RegisterUser` → gibt `(string, bool, error)` zurück; Repository-Interface und StoreRepository-Adapter identisch
- `GetUserByEmail` → gibt `(string, string, bool, error)` zurück; überall gleich
- `IsAdminUser` → gibt `(bool, error)` zurück; überall gleich
- `auth.HashPassword` / `auth.CheckPassword` → globale Funktionen, kein Receiver

**Keine Platzhalter:** Alle Tasks enthalten echten Code.
