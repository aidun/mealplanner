package config

import (
	"errors"
	"os"
	"strings"
)

type Config struct {
	AppEnv                   string
	Port                     string
	DatabaseURL              string
	APISecret                string
	CORSOrigins              []string
	EmailEnabled             bool
	EmailProvider            string
	EmailFrom                string
	EmailReplyTo             string
	ResendAPIKey             string
	OpenAIAPIKey             string
	OpenAIModel              string
	ProviderMode             string
	AuthBaseURL              string
	SessionSecret            string
	AuthAllowedSubjectHashes []string
	AuthAllowedEmailHashes   []string
	GoogleClientID           string
	GoogleClientSecret       string
	AppleClientID            string
	AppleTeamID              string
	AppleKeyID               string
	ApplePrivateKey          string
}

func Load() (Config, error) {
	cfg := Config{
		AppEnv:                   getenvDefault("APP_ENV", "development"),
		Port:                     getenvDefault("PORT", "3001"),
		DatabaseURL:              strings.TrimSpace(os.Getenv("DATABASE_URL")),
		APISecret:                strings.TrimSpace(os.Getenv("API_SECRET")),
		CORSOrigins:              parseList(os.Getenv("CORS_ORIGINS")),
		EmailEnabled:             parseBoolDefault("EMAIL_ENABLED", false),
		EmailProvider:            strings.ToLower(strings.TrimSpace(getenvDefault("EMAIL_PROVIDER", "noop"))),
		EmailFrom:                strings.TrimSpace(os.Getenv("EMAIL_FROM")),
		EmailReplyTo:             strings.TrimSpace(os.Getenv("EMAIL_REPLY_TO")),
		ResendAPIKey:             strings.TrimSpace(os.Getenv("RESEND_API_KEY")),
		OpenAIAPIKey:             strings.TrimSpace(os.Getenv("OPENAI_API_KEY")),
		OpenAIModel:              getenvDefault("OPENAI_MEAL_MODEL", "gpt-5.4-mini"),
		ProviderMode:             getenvDefault("PROVIDER_MODE", "mock"),
		AuthBaseURL:              strings.TrimRight(strings.TrimSpace(os.Getenv("AUTH_BASE_URL")), "/"),
		SessionSecret:            strings.TrimSpace(os.Getenv("SESSION_SECRET")),
		AuthAllowedSubjectHashes: parseList(os.Getenv("AUTH_ALLOWED_SUBJECT_HASHES")),
		AuthAllowedEmailHashes:   parseList(os.Getenv("AUTH_ALLOWED_EMAIL_HASHES")),
		GoogleClientID:           strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID")),
		GoogleClientSecret:       strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET")),
		AppleClientID:            strings.TrimSpace(os.Getenv("APPLE_CLIENT_ID")),
		AppleTeamID:              strings.TrimSpace(os.Getenv("APPLE_TEAM_ID")),
		AppleKeyID:               strings.TrimSpace(os.Getenv("APPLE_KEY_ID")),
		ApplePrivateKey:          strings.TrimSpace(os.Getenv("APPLE_PRIVATE_KEY")),
	}
	cfg.AppEnv = strings.ToLower(strings.TrimSpace(cfg.AppEnv))
	if cfg.AppEnv == "" {
		cfg.AppEnv = "development"
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

func (c Config) Validate() error {
	c.AppEnv = strings.ToLower(strings.TrimSpace(c.AppEnv))
	if c.AppEnv == "" {
		c.AppEnv = "development"
	}
	if c.ProviderMode != "" && !strings.EqualFold(c.ProviderMode, "mock") && !strings.EqualFold(c.ProviderMode, "live") {
		return errors.New("PROVIDER_MODE must be mock or live")
	}
	if c.EmailProvider == "" {
		c.EmailProvider = "noop"
	}
	switch strings.ToLower(c.EmailProvider) {
	case "noop", "resend":
	default:
		return errors.New("EMAIL_PROVIDER must be noop or resend")
	}
	if c.EmailEnabled {
		if !configuredValue(c.EmailFrom) {
			return errors.New("EMAIL_FROM must be configured when EMAIL_ENABLED=true")
		}
		if !configuredValue(c.EmailReplyTo) {
			return errors.New("EMAIL_REPLY_TO must be configured when EMAIL_ENABLED=true")
		}
		if strings.EqualFold(c.EmailProvider, "resend") && !configuredValue(c.ResendAPIKey) {
			return errors.New("RESEND_API_KEY must be configured when EMAIL_ENABLED=true and EMAIL_PROVIDER=resend")
		}
	}
	if c.AppEnv != "production" {
		return nil
	}
	if !strings.HasPrefix(c.AuthBaseURL, "https://") {
		return errors.New("AUTH_BASE_URL must use https in production")
	}
	if !configuredValue(c.SessionSecret) || len(c.SessionSecret) < 32 {
		return errors.New("SESSION_SECRET must be configured with at least 32 characters in production")
	}
	if strings.EqualFold(c.ProviderMode, "live") && !configuredValue(c.OpenAIAPIKey) {
		return errors.New("OPENAI_API_KEY is required in production when PROVIDER_MODE=live")
	}
	if len(c.CORSOrigins) == 0 {
		return errors.New("CORS_ORIGINS must be configured in production")
	}
	for _, origin := range c.CORSOrigins {
		if !strings.HasPrefix(origin, "https://") {
			return errors.New("CORS_ORIGINS must only contain https origins in production")
		}
	}
	if !configuredValue(c.GoogleClientID) || !configuredValue(c.GoogleClientSecret) {
		return errors.New("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured in production")
	}
	if len(c.AuthAllowedSubjectHashes) == 0 && len(c.AuthAllowedEmailHashes) == 0 {
		return errors.New("an auth allowlist must be configured in production")
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

func parseBoolDefault(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	switch strings.ToLower(value) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}
