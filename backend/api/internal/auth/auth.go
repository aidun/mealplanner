package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	SessionCookieName = "mealplanner_session"
	StateCookieName   = "mealplanner_oauth_state"
)

var (
	ErrNotAuthenticated = errors.New("not authenticated")
	ErrNotAllowed       = errors.New("login not allowed")
	ErrInvalidState     = errors.New("invalid oauth state")
)

type Provider struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Enabled  bool   `json:"enabled"`
	StartURL string `json:"startUrl,omitempty"`
}

type Config struct {
	BaseURL              string
	SessionSecret        string
	AllowedSubjectHashes []string
	AllowedEmailHashes   []string
	GoogleClientID       string
	GoogleClientSecret   string
	AppleClientID        string
	AppleTeamID          string
	AppleKeyID           string
	ApplePrivateKey      string
}

type Service struct {
	cfg    Config
	client *http.Client
}

type Identity struct {
	Provider    string
	SubjectHash string
	EmailHash   string
}

type GoogleTokenInfo struct {
	Audience string `json:"aud"`
	Subject  string `json:"sub"`
	Email    string `json:"email"`
}

func NewService(cfg Config) Service {
	return Service{
		cfg: cfg,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (s Service) Providers() []Provider {
	google := Provider{ID: "google", Name: "Google", Enabled: s.GoogleEnabled()}
	if google.Enabled {
		google.StartURL = "/api/auth/google/start"
	}
	apple := Provider{ID: "apple", Name: "Apple", Enabled: s.AppleEnabled()}
	if apple.Enabled {
		apple.StartURL = "/api/auth/apple/start"
	}
	return []Provider{
		google,
		apple,
	}
}

func (s Service) BaseURL() string {
	return strings.TrimRight(strings.TrimSpace(s.cfg.BaseURL), "/")
}

func (s Service) GoogleEnabled() bool {
	return configured(s.cfg.BaseURL) && configured(s.cfg.GoogleClientID) && configured(s.cfg.GoogleClientSecret) && configured(s.cfg.SessionSecret)
}

func (s Service) AppleEnabled() bool {
	return configured(s.cfg.BaseURL) && configured(s.cfg.AppleClientID) && configured(s.cfg.AppleTeamID) && configured(s.cfg.AppleKeyID) && configured(s.cfg.ApplePrivateKey)
}

func (s Service) GoogleStartURL(state, nonce, codeChallenge string) string {
	values := url.Values{}
	values.Set("client_id", s.cfg.GoogleClientID)
	values.Set("redirect_uri", s.RedirectURL("google"))
	values.Set("response_type", "code")
	values.Set("scope", "openid email")
	values.Set("state", state)
	values.Set("nonce", nonce)
	values.Set("code_challenge", codeChallenge)
	values.Set("code_challenge_method", "S256")
	return "https://accounts.google.com/o/oauth2/v2/auth?" + values.Encode()
}

func (s Service) RedirectURL(provider string) string {
	return strings.TrimRight(s.cfg.BaseURL, "/") + "/api/auth/" + provider + "/callback"
}

func (s Service) ExchangeGoogleCode(ctx context.Context, code, verifier, expectedNonce string) (Identity, error) {
	form := url.Values{}
	form.Set("client_id", s.cfg.GoogleClientID)
	form.Set("client_secret", s.cfg.GoogleClientSecret)
	form.Set("code", code)
	form.Set("code_verifier", verifier)
	form.Set("grant_type", "authorization_code")
	form.Set("redirect_uri", s.RedirectURL("google"))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth2.googleapis.com/token", strings.NewReader(form.Encode()))
	if err != nil {
		return Identity{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := s.client.Do(req)
	if err != nil {
		return Identity{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return Identity{}, fmt.Errorf("google token exchange failed: %s", resp.Status)
	}
	var tokenResp struct {
		IDToken string `json:"id_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return Identity{}, err
	}
	return s.VerifyGoogleIDToken(ctx, tokenResp.IDToken, expectedNonce)
}

func (s Service) VerifyGoogleIDToken(ctx context.Context, idToken string, expectedNonce string) (Identity, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://oauth2.googleapis.com/tokeninfo?id_token="+url.QueryEscape(idToken), nil)
	if err != nil {
		return Identity{}, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return Identity{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return Identity{}, fmt.Errorf("google tokeninfo failed: %s", resp.Status)
	}
	var info GoogleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return Identity{}, err
	}
	if info.Audience != s.cfg.GoogleClientID {
		return Identity{}, errors.New("google token audience mismatch")
	}
	if strings.TrimSpace(expectedNonce) != "" {
		nonce, err := idTokenNonce(idToken)
		if err != nil {
			return Identity{}, err
		}
		if nonce != expectedNonce {
			return Identity{}, errors.New("google token nonce mismatch")
		}
	}
	identity := Identity{
		Provider:    "google",
		SubjectHash: s.Hash("google:" + info.Subject),
	}
	if strings.TrimSpace(info.Email) != "" {
		identity.EmailHash = s.Hash("email:" + strings.ToLower(strings.TrimSpace(info.Email)))
	}
	if !s.Allowed(identity) {
		return Identity{}, ErrNotAllowed
	}
	return identity, nil
}

func idTokenNonce(idToken string) (string, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) < 2 {
		return "", errors.New("invalid google id token")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", err
	}
	var claims struct {
		Nonce string `json:"nonce"`
	}
	if err := json.Unmarshal(raw, &claims); err != nil {
		return "", err
	}
	if strings.TrimSpace(claims.Nonce) == "" {
		return "", errors.New("google token nonce missing")
	}
	return claims.Nonce, nil
}

func (s Service) Allowed(identity Identity) bool {
	if len(s.cfg.AllowedSubjectHashes) == 0 && len(s.cfg.AllowedEmailHashes) == 0 {
		return false
	}
	if contains(s.cfg.AllowedSubjectHashes, identity.SubjectHash) {
		return true
	}
	return identity.EmailHash != "" && contains(s.cfg.AllowedEmailHashes, identity.EmailHash)
}

func (s Service) Hash(value string) string {
	mac := hmac.New(sha256.New, []byte(s.cfg.SessionSecret))
	_, _ = mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

func NewOAuthState() (state, nonce, verifier, challenge string, err error) {
	state, err = randomURLToken(32)
	if err != nil {
		return "", "", "", "", err
	}
	nonce, err = randomURLToken(32)
	if err != nil {
		return "", "", "", "", err
	}
	verifier, err = randomURLToken(48)
	if err != nil {
		return "", "", "", "", err
	}
	sum := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(sum[:])
	return state, nonce, verifier, challenge, nil
}

func randomURLToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func contains(values []string, value string) bool {
	for _, candidate := range values {
		if strings.TrimSpace(candidate) == value {
			return true
		}
	}
	return false
}

func configured(value string) bool {
	value = strings.TrimSpace(value)
	return value != "" && !strings.HasPrefix(value, "__set_")
}
