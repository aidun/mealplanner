package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const resendEndpoint = "https://api.resend.com/emails"

type httpClient interface {
	Do(req *http.Request) (*http.Response, error)
}

type Resend struct {
	from    string
	replyTo string
	apiKey  string
	client  httpClient
}

func NewResend(from string, replyTo string, apiKey string, client httpClient) Resend {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return Resend{
		from:    strings.TrimSpace(from),
		replyTo: strings.TrimSpace(replyTo),
		apiKey:  strings.TrimSpace(apiKey),
		client:  client,
	}
}

func (r Resend) SendInviteEmail(ctx context.Context, payload InviteEmail) error {
	return r.send(ctx, resendMessage{
		From:    r.from,
		To:      []string{strings.TrimSpace(payload.To)},
		ReplyTo: []string{r.replyTo},
		Subject: renderedSubject(payload.Subject, inviteSubject(payload)),
		Text:    renderedBody(payload.TextBody, inviteText(payload)),
		HTML:    renderedBody(payload.HTMLBody, inviteHTML(payload)),
	})
}

func (r Resend) SendPremiumInviteEmail(ctx context.Context, payload PremiumInviteEmail) error {
	return r.send(ctx, resendMessage{
		From:    r.from,
		To:      []string{strings.TrimSpace(payload.To)},
		ReplyTo: []string{r.replyTo},
		Subject: renderedSubject(payload.Subject, premiumInviteSubject(payload)),
		Text:    renderedBody(payload.TextBody, premiumInviteText(payload)),
		HTML:    renderedBody(payload.HTMLBody, premiumInviteHTML(payload)),
	})
}

func (r Resend) SendWeeklyPlanReadyEmail(ctx context.Context, payload WeeklyPlanReadyEmail) error {
	return r.send(ctx, resendMessage{
		From:    r.from,
		To:      []string{strings.TrimSpace(payload.To)},
		ReplyTo: []string{r.replyTo},
		Subject: renderedSubject(payload.Subject, weeklySubject(payload)),
		Text:    renderedBody(payload.TextBody, weeklyText(payload)),
		HTML:    renderedBody(payload.HTMLBody, weeklyHTML(payload)),
	})
}

type resendMessage struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	ReplyTo []string `json:"reply_to,omitempty"`
	Subject string   `json:"subject"`
	Text    string   `json:"text,omitempty"`
	HTML    string   `json:"html,omitempty"`
}

func (r Resend) send(ctx context.Context, payload resendMessage) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, resendEndpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	return fmt.Errorf("resend send failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(respBody)))
}

func renderedSubject(override string, fallback string) string {
	if strings.TrimSpace(override) != "" {
		return strings.TrimSpace(override)
	}
	return strings.TrimSpace(fallback)
}

func renderedBody(override string, fallback string) string {
	if strings.TrimSpace(override) != "" {
		return strings.TrimSpace(override)
	}
	return strings.TrimSpace(fallback)
}
