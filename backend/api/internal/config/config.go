package config

import (
	"errors"
	"os"
	"strings"
)

type Config struct {
	Port                     string
	DatabaseURL              string
	APISecret                string
	CORSOrigins              []string
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
		Port:                     getenvDefault("PORT", "3001"),
		DatabaseURL:              strings.TrimSpace(os.Getenv("DATABASE_URL")),
		APISecret:                strings.TrimSpace(os.Getenv("API_SECRET")),
		CORSOrigins:              parseList(os.Getenv("CORS_ORIGINS")),
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
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	return cfg, nil
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
