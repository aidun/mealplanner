package config

import (
	"errors"
	"os"
	"strings"
)

type Config struct {
	Port         string
	DatabaseURL  string
	APISecret    string
	CORSOrigins  []string
	OpenAIAPIKey string
	OpenAIModel  string
	ProviderMode string
}

func Load() (Config, error) {
	cfg := Config{
		Port:         getenvDefault("PORT", "3001"),
		DatabaseURL:  strings.TrimSpace(os.Getenv("DATABASE_URL")),
		APISecret:    strings.TrimSpace(os.Getenv("API_SECRET")),
		CORSOrigins:  parseList(os.Getenv("CORS_ORIGINS")),
		OpenAIAPIKey: strings.TrimSpace(os.Getenv("OPENAI_API_KEY")),
		OpenAIModel:  getenvDefault("OPENAI_MEAL_MODEL", "gpt-5.4-mini"),
		ProviderMode: getenvDefault("PROVIDER_MODE", "mock"),
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
