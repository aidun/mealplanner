package auth

import (
	"encoding/base64"
	"testing"
)

func TestHashAndAllowlist(t *testing.T) {
	service := NewService(Config{SessionSecret: "test-secret"})
	subjectHash := service.Hash("google:subject-1")
	emailHash := service.Hash("email:markus@example.test")

	allowedBySubject := NewService(Config{
		SessionSecret:        "test-secret",
		AllowedSubjectHashes: []string{subjectHash},
	})
	if !allowedBySubject.Allowed(Identity{Provider: "google", SubjectHash: subjectHash}) {
		t.Fatal("expected subject hash to be allowed")
	}

	allowedByEmail := NewService(Config{
		SessionSecret:      "test-secret",
		AllowedEmailHashes: []string{emailHash},
	})
	if !allowedByEmail.Allowed(Identity{Provider: "google", SubjectHash: "other", EmailHash: emailHash}) {
		t.Fatal("expected email hash to be allowed")
	}

	denied := NewService(Config{SessionSecret: "test-secret"})
	if denied.Allowed(Identity{Provider: "google", SubjectHash: subjectHash, EmailHash: emailHash}) {
		t.Fatal("expected empty allowlist to deny login")
	}
}

func TestProviderPlaceholdersAreDisabled(t *testing.T) {
	service := NewService(Config{
		BaseURL:            "__set_https_auth_base_url__",
		SessionSecret:      "__set_random_session_secret_min_32_bytes__",
		GoogleClientID:     "__set_google_client_id__",
		GoogleClientSecret: "__set_google_client_secret__",
		AppleClientID:      "__set_apple_client_id__",
		AppleTeamID:        "__set_apple_team_id__",
		AppleKeyID:         "__set_apple_key_id__",
		ApplePrivateKey:    "__set_apple_private_key__",
	})

	if service.GoogleEnabled() {
		t.Fatal("expected google to be disabled with placeholder config")
	}
	if service.AppleEnabled() {
		t.Fatal("expected apple to be disabled with placeholder config")
	}
	for _, provider := range service.Providers() {
		if provider.Enabled || provider.StartURL != "" {
			t.Fatalf("expected disabled provider without start url, got %+v", provider)
		}
	}
}

func TestProvidersExposeStartURLsWhenConfigured(t *testing.T) {
	service := NewService(Config{
		BaseURL:            "https://mealplanner.example",
		SessionSecret:      "session-secret",
		GoogleClientID:     "google-client",
		GoogleClientSecret: "google-secret",
	})

	providers := service.Providers()
	if !providers[0].Enabled || providers[0].StartURL != "/api/auth/google/start" {
		t.Fatalf("unexpected google provider: %+v", providers[0])
	}
	if providers[1].Enabled || providers[1].StartURL != "" {
		t.Fatalf("unexpected apple provider: %+v", providers[1])
	}
}

func TestIDTokenNonce(t *testing.T) {
	token := "header." + base64.RawURLEncoding.EncodeToString([]byte(`{"nonce":"nonce-1"}`)) + ".signature"
	nonce, err := idTokenNonce(token)
	if err != nil {
		t.Fatal(err)
	}
	if nonce != "nonce-1" {
		t.Fatalf("unexpected nonce %q", nonce)
	}
}

func TestIDTokenNonceRequiresClaim(t *testing.T) {
	token := "header." + base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"subject"}`)) + ".signature"
	if _, err := idTokenNonce(token); err == nil {
		t.Fatal("expected missing nonce error")
	}
}
