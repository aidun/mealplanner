package mailer

import (
	"fmt"
	"strings"

	"github.com/aidun/mealplanner/backend/api/internal/brand"
)

type TemplateDefaults struct {
	Label       string
	Subject     string
	TextBody    string
	HTMLBody    string
	Description string
	Variables   []string
}

const (
	TemplateKindFamilyInvite    = "family_invite"
	TemplateKindPremiumInvite   = "premium_invite"
	TemplateKindWeeklyPlanReady = "weekly_plan_ready"
)

func DefaultTemplate(kind string) (TemplateDefaults, bool) {
	switch strings.TrimSpace(kind) {
	case TemplateKindFamilyInvite:
		return TemplateDefaults{
			Label:       "Familien-Einladung",
			Subject:     "Einladung zu Mahlio von {{family_name}}",
			TextBody:    "Du wurdest zu einem Mahlio-Familienkonto eingeladen.\nFamilienkonto: {{family_name}}\n\nMit dem Annehmen der Einladung wird dein persoenlicher Account in dieses Familienkonto ueberfuehrt.\n{{warning_text}}\n\nEinladung annehmen:\n{{invite_link}}\n\nRueckfragen:\n{{support_email}}",
			HTMLBody:    "<p>Du wurdest zu einem Mahlio-Familienkonto eingeladen.</p><p><strong>Familienkonto:</strong> {{family_name}}</p><p>Mit dem Annehmen der Einladung wird dein persoenlicher Account in dieses Familienkonto ueberfuehrt.</p><p>{{warning_text}}</p><p><a href=\"{{invite_link}}\">Einladung annehmen</a></p><p>Rueckfragen: {{support_email}}</p>",
			Description: "Mail für Einladungen in ein Familienkonto.",
			Variables:   []string{"{{family_name}}", "{{invite_link}}", "{{warning_text}}", "{{support_email}}"},
		}, true
	case TemplateKindPremiumInvite:
		return TemplateDefaults{
			Label:       "Premium-Einladung",
			Subject:     "Mahlio Premium ist für dich freigeschaltet",
			TextBody:    "Hallo,\n\nMahlio Premium ist gerade für dich freigeschaltet.\nDer inoffizielle Deal: Premium kostet aktuell nichts, dafuer freuen wir uns ueber ehrliches Feedback.\nUnten rechts in der App findest du den Feedback-Button.\n\nZur App:\n{{app_url}}\n\nRueckfragen:\n{{support_email}}",
			HTMLBody:    "<p>Hallo,</p><p>Mahlio Premium ist gerade fuer dich freigeschaltet.</p><p>Der inoffizielle Deal: Premium kostet aktuell nichts, dafuer freuen wir uns ueber ehrliches Feedback.</p><p>Unten rechts in der App findest du den Feedback-Button.</p><p><a href=\"{{app_url}}\">Zur App</a></p><p>Rueckfragen: {{support_email}}</p>",
			Description: "Mail beim Freischalten eines Premium-Nutzers.",
			Variables:   []string{"{{app_url}}", "{{support_email}}"},
		}, true
	case TemplateKindWeeklyPlanReady:
		return TemplateDefaults{
			Label:       "Wochenplan fertig",
			Subject:     "Neuer Wochenplan ab {{week_start}}",
			TextBody:    "Hallo {{family_name}},\n\ndein neuer automatischer Mahlio-Wochenplan ab {{week_start}} ist fertig.\n\nPlan ansehen:\n{{plan_url}}\n\nRueckfragen:\n{{support_email}}",
			HTMLBody:    "<p>Hallo {{family_name}},</p><p>dein neuer automatischer Mahlio-Wochenplan ab <strong>{{week_start}}</strong> ist fertig.</p><p><a href=\"{{plan_url}}\">Plan ansehen</a></p><p>Rueckfragen: {{support_email}}</p>",
			Description: "Mail, wenn ein automatischer Wochenplan erstellt wurde.",
			Variables:   []string{"{{family_name}}", "{{week_start}}", "{{plan_url}}", "{{support_email}}"},
		}, true
	default:
		return TemplateDefaults{}, false
	}
}

func DefaultTemplateKinds() []string {
	return []string{TemplateKindFamilyInvite, TemplateKindPremiumInvite, TemplateKindWeeklyPlanReady}
}

func inviteSubject(payload InviteEmail) string {
	if strings.TrimSpace(payload.FamilyName) == "" {
		return "Einladung zu " + brand.Name
	}
	return fmt.Sprintf("Einladung zu %s von %s", brand.Name, strings.TrimSpace(payload.FamilyName))
}

func premiumInviteSubject(_ PremiumInviteEmail) string {
	return brand.Name + " Premium ist fuer dich freigeschaltet"
}

func premiumInviteText(payload PremiumInviteEmail) string {
	var lines []string
	lines = append(lines, "Hallo,")
	lines = append(lines, "")
	lines = append(lines, brand.Name+" Premium ist gerade fuer dich freigeschaltet.")
	lines = append(lines, "Der inoffizielle Deal: Premium kostet aktuell nichts, dafuer freuen wir uns ueber ehrliches Feedback.")
	lines = append(lines, "Unten rechts in der App findest du den Feedback-Button.")
	lines = append(lines, "")
	lines = append(lines, "Zur App:")
	lines = append(lines, strings.TrimSpace(payload.FeedbackURL))
	if support := strings.TrimSpace(payload.SupportEmail); support != "" {
		lines = append(lines, "")
		lines = append(lines, "Rueckfragen:")
		lines = append(lines, support)
	}
	return strings.Join(lines, "\n")
}

func premiumInviteHTML(payload PremiumInviteEmail) string {
	return fmt.Sprintf(
		"<p>Hallo,</p><p>%s Premium ist gerade fuer dich freigeschaltet.</p><p>Der inoffizielle Deal: Premium kostet aktuell nichts, dafuer freuen wir uns ueber ehrliches Feedback.</p><p>Unten rechts in der App findest du den Feedback-Button.</p><p><a href=\"%s\">Zur App</a></p><p>Rueckfragen: %s</p>",
		htmlText(brand.Name, brand.Name),
		htmlEscape(payload.FeedbackURL),
		htmlText(payload.SupportEmail, "-"),
	)
}

func inviteText(payload InviteEmail) string {
	var lines []string
	lines = append(lines, "Du wurdest zu einem "+brand.Name+"-Familienkonto eingeladen.")
	if name := strings.TrimSpace(payload.FamilyName); name != "" {
		lines = append(lines, fmt.Sprintf("Familienkonto: %s", name))
	}
	lines = append(lines, "")
	lines = append(lines, "Mit dem Annehmen der Einladung wird dein persoenlicher Account in dieses Familienkonto ueberfuehrt.")
	if warning := strings.TrimSpace(payload.WarningText); warning != "" {
		lines = append(lines, warning)
	}
	lines = append(lines, "")
	lines = append(lines, "Einladung annehmen:")
	lines = append(lines, strings.TrimSpace(payload.InviteLink))
	if support := strings.TrimSpace(payload.SupportEmail); support != "" {
		lines = append(lines, "")
		lines = append(lines, "Rueckfragen:")
		lines = append(lines, support)
	}
	return strings.Join(lines, "\n")
}

func inviteHTML(payload InviteEmail) string {
	return fmt.Sprintf(
		"<p>Du wurdest zu einem %s-Familienkonto eingeladen.</p><p><strong>Familienkonto:</strong> %s</p><p>Mit dem Annehmen der Einladung wird dein persoenlicher Account in dieses Familienkonto ueberfuehrt.</p><p>%s</p><p><a href=\"%s\">Einladung annehmen</a></p><p>Rueckfragen: %s</p>",
		htmlText(brand.Name, brand.Name),
		htmlText(payload.FamilyName, brand.Name),
		htmlText(payload.WarningText, "Dein Profil wird beim Annehmen sinnvoll zusammengefuehrt."),
		htmlEscape(payload.InviteLink),
		htmlText(payload.SupportEmail, "-"),
	)
}

func weeklySubject(payload WeeklyPlanReadyEmail) string {
	return fmt.Sprintf("Neuer Wochenplan ab %s", strings.TrimSpace(payload.WeekStart))
}

func weeklyText(payload WeeklyPlanReadyEmail) string {
	var lines []string
	if name := strings.TrimSpace(payload.FamilyName); name != "" {
		lines = append(lines, fmt.Sprintf("Hallo %s,", name))
	} else {
		lines = append(lines, "Hallo,")
	}
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("dein neuer automatischer %s-Wochenplan ab %s ist fertig.", brand.Name, strings.TrimSpace(payload.WeekStart)))
	lines = append(lines, "")
	lines = append(lines, "Plan ansehen:")
	lines = append(lines, strings.TrimSpace(payload.PlanURL))
	if support := strings.TrimSpace(payload.SupportEmail); support != "" {
		lines = append(lines, "")
		lines = append(lines, "Rueckfragen:")
		lines = append(lines, support)
	}
	return strings.Join(lines, "\n")
}

func weeklyHTML(payload WeeklyPlanReadyEmail) string {
	return fmt.Sprintf(
		"<p>Hallo %s,</p><p>dein neuer automatischer %s-Wochenplan ab <strong>%s</strong> ist fertig.</p><p><a href=\"%s\">Plan ansehen</a></p><p>Rueckfragen: %s</p>",
		htmlText(payload.FamilyName, brand.Name),
		htmlText(brand.Name, brand.Name),
		htmlText(payload.WeekStart, "-"),
		htmlEscape(payload.PlanURL),
		htmlText(payload.SupportEmail, "-"),
	)
}

func htmlText(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		value = fallback
	}
	return htmlEscape(value)
}

func htmlEscape(value string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		"\"", "&quot;",
		"'", "&#39;",
	)
	return replacer.Replace(value)
}

func RenderTemplate(template string, values map[string]string) string {
	rendered := template
	for key, value := range values {
		rendered = strings.ReplaceAll(rendered, key, strings.TrimSpace(value))
	}
	return strings.TrimSpace(rendered)
}
