package mailer

import (
	"context"
	"errors"
	"strings"
)

// Mailer abstracts transactional email so tests and local development can use Noop safely.
type Mailer interface {
	SendInviteEmail(ctx context.Context, payload InviteEmail) error
	SendPremiumInviteEmail(ctx context.Context, payload PremiumInviteEmail) error
	SendWeeklyPlanReadyEmail(ctx context.Context, payload WeeklyPlanReadyEmail) error
}

type InviteEmail struct {
	To           string
	FamilyName   string
	InviteLink   string
	WarningText  string
	SupportEmail string
	Subject      string
	TextBody     string
	HTMLBody     string
}

type PremiumInviteEmail struct {
	To           string
	SupportEmail string
	FeedbackURL  string
	Subject      string
	TextBody     string
	HTMLBody     string
}

type WeeklyPlanReadyEmail struct {
	To           string
	FamilyName   string
	WeekStart    string
	PlanURL      string
	SupportEmail string
	Subject      string
	TextBody     string
	HTMLBody     string
}

// Config contains provider setup only; message copy comes from templates or admin overrides.
type Config struct {
	Enabled      bool
	Provider     string
	From         string
	ReplyTo      string
	ResendAPIKey string
}

// New selects the configured provider and deliberately falls back to Noop when email is disabled.
func New(cfg Config) (Mailer, error) {
	if !cfg.Enabled {
		return Noop{}, nil
	}
	provider := strings.ToLower(strings.TrimSpace(cfg.Provider))
	if provider == "" || provider == "noop" {
		return Noop{}, nil
	}
	switch provider {
	case "resend":
		if strings.TrimSpace(cfg.From) == "" || strings.TrimSpace(cfg.ReplyTo) == "" || strings.TrimSpace(cfg.ResendAPIKey) == "" {
			return nil, errors.New("resend mailer requires from, reply-to and api key")
		}
		return NewResend(cfg.From, cfg.ReplyTo, cfg.ResendAPIKey, nil), nil
	default:
		return nil, errors.New("unsupported email provider")
	}
}
