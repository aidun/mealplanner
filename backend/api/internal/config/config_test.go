package config

import (
	"reflect"
	"testing"
)

func TestLoadTrimsAndDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", " postgres://example ")
	t.Setenv("AUTH_BASE_URL", " https://mealplanner.example/ ")
	t.Setenv("CORS_ORIGINS", " https://mealplanner.example, ,https://admin.example ")
	t.Setenv("AUTH_ALLOWED_EMAIL_HASHES", " hash-1,hash-2 ")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
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
}

func TestLoadRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", " ")
	if _, err := Load(); err == nil {
		t.Fatal("expected missing database url error")
	}
}
