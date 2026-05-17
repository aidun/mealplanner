package config

import (
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("SESSION_SECRET", "12345678901234567890123456789012")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != "3001" {
		t.Fatalf("unexpected default port: %q", cfg.Port)
	}
	if cfg.OpenAIModel != "gpt-5.4-mini" {
		t.Fatalf("unexpected default model: %q", cfg.OpenAIModel)
	}
	if cfg.ProviderMode != "mock" {
		t.Fatalf("unexpected default provider mode: %q", cfg.ProviderMode)
	}
	if cfg.OpenAIBaseURL != "https://api.openai.com" {
		t.Fatalf("unexpected default base url: %q", cfg.OpenAIBaseURL)
	}
}

func TestLoadTrimsDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "  postgres://example  ")
	t.Setenv("SESSION_SECRET", "12345678901234567890123456789012")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DatabaseURL != "postgres://example" {
		t.Fatalf("database url was not trimmed: %q", cfg.DatabaseURL)
	}
}

func TestLoadParsesCORSOrigins(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("SESSION_SECRET", "12345678901234567890123456789012")
	t.Setenv("CORS_ORIGINS", " https://a.example, ,https://b.example ")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(cfg.CORSOrigins) != 2 || cfg.CORSOrigins[0] != "https://a.example" || cfg.CORSOrigins[1] != "https://b.example" {
		t.Fatalf("unexpected cors origins: %#v", cfg.CORSOrigins)
	}
}

func TestLoadRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", " ")
	if _, err := Load(); err == nil {
		t.Fatal("expected missing database url error")
	}
}

func TestLoadRequiresSessionSecret(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("SESSION_SECRET", "")
	if _, err := Load(); err == nil {
		t.Fatal("expected missing session secret error")
	}
}

func TestLoadRejectsShortSessionSecret(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("SESSION_SECRET", "tooshort")
	if _, err := Load(); err == nil {
		t.Fatal("expected short session secret error")
	}
}

func TestLoadRequiresOpenAIKeyInLiveMode(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("SESSION_SECRET", "12345678901234567890123456789012")
	t.Setenv("PROVIDER_MODE", "live")
	t.Setenv("OPENAI_API_KEY", "")
	if _, err := Load(); err == nil {
		t.Fatal("expected openai api key error")
	}
}

func TestLoadLiveModeWithKey(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("SESSION_SECRET", "12345678901234567890123456789012")
	t.Setenv("PROVIDER_MODE", "live")
	t.Setenv("OPENAI_API_KEY", "sk-test")

	if _, err := Load(); err != nil {
		t.Fatalf("expected valid live config, got: %v", err)
	}
}
