package mailer

import (
	"context"
	"errors"
	"strings"
)

type Mailer interface {
	SendInviteEmail(ctx context.Context, payload InviteEmail) error
	SendWeeklyPlanReadyEmail(ctx context.Context, payload WeeklyPlanReadyEmail) error
}

type InviteEmail struct {
	To           string
	FamilyName   string
	InviteLink   string
	WarningText  string
	SupportEmail string
}

type WeeklyPlanReadyEmail struct {
	To           string
	FamilyName   string
	WeekStart    string
	PlanURL      string
	SupportEmail string
}

type Config struct {
	Enabled      bool
	Provider     string
	From         string
	ReplyTo      string
	ResendAPIKey string
}

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
