package config

import (
	"errors"
	"os"
	"strings"
)

// Config is the normalized runtime configuration after environment parsing.
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
	AuthRequired  bool
}

// Load reads environment variables, applies defaults and validates the result.
func Load() (Config, error) {
	authRequired := !strings.EqualFold(strings.TrimSpace(os.Getenv("AUTH_REQUIRED")), "false")
	sessionSecret := strings.TrimSpace(os.Getenv("SESSION_SECRET"))
	if !authRequired && sessionSecret == "" {
		sessionSecret = "guest-mode-default-secret-no-auth-required"
	}
	cfg := Config{
		Port:          getenvDefault("PORT", "3001"),
		DatabaseURL:   strings.TrimSpace(os.Getenv("DATABASE_URL")),
		APISecret:     strings.TrimSpace(os.Getenv("API_SECRET")),
		CORSOrigins:   parseList(os.Getenv("CORS_ORIGINS")),
		OpenAIAPIKey:  strings.TrimSpace(os.Getenv("OPENAI_API_KEY")),
		OpenAIBaseURL: getenvDefault("OPENAI_BASE_URL", "https://api.openai.com"),
		OpenAIModel:   getenvDefault("OPENAI_MEAL_MODEL", "gpt-5.4-mini"),
		ProviderMode:  getenvDefault("PROVIDER_MODE", "mock"),
		SessionSecret: sessionSecret,
		AuthRequired:  authRequired,
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

// Validate rejects unsupported modes and enforces security-critical constraints.
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

func getenvDefault(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

func parseList(v string) []string {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	return out
}

func configuredValue(value string) bool {
	value = strings.TrimSpace(value)
	return value != "" && !strings.HasPrefix(value, "__set_")
}
