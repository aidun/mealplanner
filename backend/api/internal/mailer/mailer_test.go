package mailer

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) Do(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestNewReturnsNoopWhenDisabled(t *testing.T) {
	instance, err := New(Config{})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := instance.(Noop); !ok {
		t.Fatalf("expected noop mailer, got %T", instance)
	}
}

func TestNewResendRequiresCredentials(t *testing.T) {
	_, err := New(Config{Enabled: true, Provider: "resend", From: "info@example.test"})
	if err == nil {
		t.Fatal("expected error for missing resend config")
	}
}

func TestResendInviteEmailBuildsPayload(t *testing.T) {
	var captured string
	client := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		body, _ := io.ReadAll(req.Body)
		captured = string(body)
		if got := req.Header.Get("Authorization"); got != "Bearer resend-key" {
			t.Fatalf("unexpected auth header %q", got)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(`{"id":"email-1"}`)),
		}, nil
	})

	instance := NewResend("info@markushartmann.dev", "info@markushartmann.dev", "resend-key", client)
	err := instance.SendInviteEmail(context.Background(), InviteEmail{
		To:           "person@example.test",
		FamilyName:   "Familie Hartmann",
		InviteLink:   "https://mealplanner.test/family/invites/accept?token=invite-token",
		WarningText:  "Der persoenliche Account wird uebernommen.",
		SupportEmail: "info@markushartmann.dev",
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		`"from":"info@markushartmann.dev"`,
		`"reply_to":["info@markushartmann.dev"]`,
		`"subject":"Komm zu Familie Hartmann auf Mahlio"`,
		`"to":["person@example.test"]`,
		`invite-token`,
	} {
		if !strings.Contains(captured, want) {
			t.Fatalf("expected payload to contain %q, got %s", want, captured)
		}
	}
}

func TestWeeklyTemplateContainsPlanURL(t *testing.T) {
	text := weeklyText(WeeklyPlanReadyEmail{
		FamilyName:   "Familie Hartmann",
		WeekStart:    "2026-04-27",
		PlanURL:      "https://mealplanner.test/",
		SupportEmail: "info@markushartmann.dev",
	})
	if !strings.Contains(text, "2026-04-27") || !strings.Contains(text, "https://mealplanner.test/") {
		t.Fatalf("unexpected weekly template %q", text)
	}
}

func TestDefaultTemplatesUseRestartBrandCopy(t *testing.T) {
	invite, ok := DefaultTemplate(TemplateKindFamilyInvite)
	if !ok || !strings.Contains(invite.TextBody, "kommst du in euren gemeinsamen Bereich bei Mahlio") {
		t.Fatalf("unexpected invite defaults: %#v", invite)
	}

	premium, ok := DefaultTemplate(TemplateKindPremiumInvite)
	if !ok || premium.Subject != "Mahlio Premium ist für euren Haushalt bereit" {
		t.Fatalf("unexpected premium defaults: %#v", premium)
	}

	weekly, ok := DefaultTemplate(TemplateKindWeeklyPlanReady)
	if !ok || weekly.Subject != "Eure Mahlio-Woche ab {{week_start}} ist bereit" {
		t.Fatalf("unexpected weekly defaults: %#v", weekly)
	}
}

func TestResendPremiumInviteEmailBuildsPayload(t *testing.T) {
	var captured string
	client := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		body, _ := io.ReadAll(req.Body)
		captured = string(body)
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(`{"id":"email-2"}`)),
		}, nil
	})

	instance := NewResend("info@markushartmann.dev", "info@markushartmann.dev", "resend-key", client)
	err := instance.SendPremiumInviteEmail(context.Background(), PremiumInviteEmail{
		To:           "person@example.test",
		SupportEmail: "info@markushartmann.dev",
		FeedbackURL:  "https://mealplanner.test/",
		Subject:      "Premium freigeschaltet",
		TextBody:     "Zur App https://mealplanner.test/",
		HTMLBody:     "<p>Zur App</p>",
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		`"subject":"Premium freigeschaltet"`,
		`"to":["person@example.test"]`,
		`https://mealplanner.test/`,
	} {
		if !strings.Contains(captured, want) {
			t.Fatalf("expected payload to contain %q, got %s", want, captured)
		}
	}
}
