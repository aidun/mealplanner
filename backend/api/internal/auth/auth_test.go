package auth

import (
	"testing"
)

func TestServiceHash(t *testing.T) {
	s := NewService(Config{SessionSecret: "test-secret-32-bytes-minimum-ok"})
	h1 := s.Hash("bring:plan-123")
	h2 := s.Hash("bring:plan-123")
	if h1 != h2 {
		t.Fatal("hash must be deterministic")
	}
	if h1 == s.Hash("bring:plan-456") {
		t.Fatal("hash must differ for different inputs")
	}
}

func TestHashPassword(t *testing.T) {
	hash, err := HashPassword("geheim123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !CheckPassword(hash, "geheim123") {
		t.Fatal("expected correct password to pass")
	}
	if CheckPassword(hash, "falsch") {
		t.Fatal("expected wrong password to fail")
	}
}

func TestCheckPasswordEmptyHash(t *testing.T) {
	if CheckPassword("", "irgendwas") {
		t.Fatal("empty hash must never match")
	}
}
