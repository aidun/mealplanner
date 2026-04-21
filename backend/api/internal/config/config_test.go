package config

import (
	"reflect"
	"testing"
)

func TestLoadTrimsAndDefaults(t *testing.T) {
	t.Setenv("APP_ENV", " development ")
	t.Setenv("DATABASE_URL", " postgres://example ")
	t.Setenv("AUTH_BASE_URL", " https://mealplanner.example/ ")
	t.Setenv("CORS_ORIGINS", " https://mealplanner.example, ,https://admin.example ")
	t.Setenv("AUTH_ALLOWED_EMAIL_HASHES", " hash-1,hash-2 ")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AppEnv != "development" {
		t.Fatalf("app env was not normalized: %q", cfg.AppEnv)
	}
	if cfg.Port != "3001" || cfg.OpenAIModel != "gpt-5.4-mini" || cfg.ProviderMode != "mock" {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	if cfg.DatabaseURL != "postgres://example" {
		t.Fatalf("database url was not trimmed: %q", cfg.DatabaseURL)
	}
	if cfg.AuthBaseURL != "https://mealplanner.example" {
		t.Fatalf("base url was not normalized: %q", cfg.AuthBaseURL)
	}
	if !reflect.DeepEqual(cfg.CORSOrigins, []string{"https://mealplanner.example", "https://admin.example"}) {
		t.Fatalf("unexpected cors origins: %#v", cfg.CORSOrigins)
	}
	if !reflect.DeepEqual(cfg.AuthAllowedEmailHashes, []string{"hash-1", "hash-2"}) {
		t.Fatalf("unexpected email hashes: %#v", cfg.AuthAllowedEmailHashes)
	}
	if cfg.EmailEnabled || cfg.EmailProvider != "noop" {
		t.Fatalf("unexpected email defaults: enabled=%v provider=%q", cfg.EmailEnabled, cfg.EmailProvider)
	}
}

func TestLoadRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", " ")
	if _, err := Load(); err == nil {
		t.Fatal("expected missing database url error")
	}
}

func TestLoadRequiresProductionConfig(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("AUTH_BASE_URL", "https://mealplanner.example")
	t.Setenv("SESSION_SECRET", "12345678901234567890123456789012")
	t.Setenv("CORS_ORIGINS", "https://mealplanner.example")
	t.Setenv("GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_ALLOWED_EMAIL_HASHES", "hash-1")
	t.Setenv("PROVIDER_MODE", "live")
	t.Setenv("OPENAI_API_KEY", "api-key")

	if _, err := Load(); err != nil {
		t.Fatalf("expected valid production config, got %v", err)
	}
}

func TestLoadRejectsPromptlyWhenProductionConfigIsIncomplete(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("AUTH_BASE_URL", "http://mealplanner.example")

	if _, err := Load(); err == nil {
		t.Fatal("expected production validation error")
	}
}

func TestLoadRequiresEmailConfigWhenEnabled(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("EMAIL_ENABLED", "true")
	t.Setenv("EMAIL_PROVIDER", "resend")

	if _, err := Load(); err == nil {
		t.Fatal("expected email validation error")
	}
}

func TestLoadAcceptsConfiguredResendMailer(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("EMAIL_ENABLED", "true")
	t.Setenv("EMAIL_PROVIDER", "resend")
	t.Setenv("EMAIL_FROM", "info@markushartmann.dev")
	t.Setenv("EMAIL_REPLY_TO", "info@markushartmann.dev")
	t.Setenv("RESEND_API_KEY", "re_test_key")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.EmailEnabled || cfg.EmailProvider != "resend" {
		t.Fatalf("unexpected email config: %+v", cfg)
	}
}
