package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"

	"golang.org/x/crypto/bcrypt"
)

const (
	SessionCookieName = "mealplanner_session"
)

var (
	ErrNotAuthenticated   = errors.New("not authenticated")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

// Config enthält nur noch die session-relevanten Werte.
type Config struct {
	SessionSecret string
}

// Service hält den session secret für HMAC-Hashing (Bring-Export).
type Service struct {
	cfg Config
}

func NewService(cfg Config) Service {
	return Service{cfg: cfg}
}

// Hash erzeugt einen stabilen HMAC-SHA256-Fingerprint — wird für den Bring-Export-Link genutzt.
func (s Service) Hash(value string) string {
	mac := hmac.New(sha256.New, []byte(s.cfg.SessionSecret))
	_, _ = mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

// HashPassword erzeugt einen bcrypt-Hash für das gegebene Klartextpasswort.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// CheckPassword vergleicht Klartext gegen einen bcrypt-Hash.
func CheckPassword(hash, password string) bool {
	if hash == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
