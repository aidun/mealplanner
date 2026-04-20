package auth

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"strings"
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

func TestGoogleStartURLIncludesOIDCProtections(t *testing.T) {
	service := NewService(Config{
		BaseURL:        "https://mealplanner.example/",
		SessionSecret:  "session-secret",
		GoogleClientID: "google-client",
	})

	startURL := service.GoogleStartURL("state-1", "nonce-1", "challenge-1")
	for _, expected := range []string{
		"https://accounts.google.com/o/oauth2/v2/auth?",
		"client_id=google-client",
		"redirect_uri=https%3A%2F%2Fmealplanner.example%2Fapi%2Fauth%2Fgoogle%2Fcallback",
		"scope=openid+email",
		"state=state-1",
		"nonce=nonce-1",
		"code_challenge=challenge-1",
		"code_challenge_method=S256",
	} {
		if !strings.Contains(startURL, expected) {
			t.Fatalf("google start url missing %q: %s", expected, startURL)
		}
	}
}

func TestVerifyGoogleIDTokenChecksNonceAndAllowlist(t *testing.T) {
	service := NewService(Config{
		SessionSecret:      "test-secret",
		GoogleClientID:     "google-client",
		AllowedEmailHashes: []string{NewService(Config{SessionSecret: "test-secret"}).Hash("email:markus@example.test")},
	})
	service.client = &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.Host != "oauth2.googleapis.com" || req.URL.Path != "/tokeninfo" {
			return nil, errors.New("unexpected request: " + req.URL.String())
		}
		body := `{"iss":"https://accounts.google.com","aud":"google-client","sub":"subject-1","email":"Markus@Example.Test","email_verified":"true"}`
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(body)),
			Header:     make(http.Header),
		}, nil
	})}
	idToken := "header." + base64.RawURLEncoding.EncodeToString([]byte(`{"nonce":"nonce-1"}`)) + ".signature"

	identity, err := service.VerifyGoogleIDToken(context.Background(), idToken, "nonce-1")
	if err != nil {
		t.Fatal(err)
	}
	if identity.Provider != "google" || identity.SubjectHash == "" || identity.EmailHash == "" {
		t.Fatalf("unexpected identity: %+v", identity)
	}

	if _, err := service.VerifyGoogleIDToken(context.Background(), idToken, "other-nonce"); err == nil {
		t.Fatal("expected nonce mismatch")
	}
}

func TestVerifyGoogleIDTokenRejectsAudienceMismatch(t *testing.T) {
	service := NewService(Config{
		SessionSecret:        "test-secret",
		GoogleClientID:       "google-client",
		AllowedSubjectHashes: []string{"irrelevant"},
	})
	service.client = &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(`{"iss":"https://accounts.google.com","aud":"other-client","sub":"subject-1"}`)),
			Header:     make(http.Header),
		}, nil
	})}
	idToken := "header." + base64.RawURLEncoding.EncodeToString([]byte(`{"nonce":"nonce-1"}`)) + ".signature"

	if _, err := service.VerifyGoogleIDToken(context.Background(), idToken, "nonce-1"); err == nil {
		t.Fatal("expected audience mismatch")
	}
}

func TestVerifyGoogleIDTokenRequiresVerifiedEmailForEmailAllowlist(t *testing.T) {
	service := NewService(Config{
		SessionSecret:      "test-secret",
		GoogleClientID:     "google-client",
		AllowedEmailHashes: []string{NewService(Config{SessionSecret: "test-secret"}).Hash("email:markus@example.test")},
	})
	service.client = &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(`{"iss":"https://accounts.google.com","aud":"google-client","sub":"subject-1","email":"markus@example.test","email_verified":"false"}`)),
			Header:     make(http.Header),
		}, nil
	})}
	idToken := "header." + base64.RawURLEncoding.EncodeToString([]byte(`{"nonce":"nonce-1"}`)) + ".signature"

	if _, err := service.VerifyGoogleIDToken(context.Background(), idToken, "nonce-1"); err == nil {
		t.Fatal("expected unverified email to be rejected")
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

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
