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
			Subject:     "Komm zu {{family_name}} auf Mahlio",
			TextBody:    "Du bist zu Mahlio eingeladen.\nHaushalt: {{family_name}}\n\nMit dem Annehmen der Einladung kommt dein Login in diesen gemeinsamen Bereich. Woche, Rezepte und Einkauf liegen dort an einem Ort.\n{{warning_text}}\n\nEinladung annehmen:\n{{invite_link}}\n\nRueckfragen:\n{{support_email}}",
			HTMLBody:    "<p>Du bist zu Mahlio eingeladen.</p><p><strong>Haushalt:</strong> {{family_name}}</p><p>Mit dem Annehmen der Einladung kommt dein Login in diesen gemeinsamen Bereich. Woche, Rezepte und Einkauf liegen dort an einem Ort.</p><p>{{warning_text}}</p><p><a href=\"{{invite_link}}\">Einladung annehmen</a></p><p>Rueckfragen: {{support_email}}</p>",
			Description: "Mail für Einladungen in einen gemeinsamen Mahlio-Haushalt.",
			Variables:   []string{"{{family_name}}", "{{invite_link}}", "{{warning_text}}", "{{support_email}}"},
		}, true
	case TemplateKindPremiumInvite:
		return TemplateDefaults{
			Label:       "Premium-Einladung",
			Subject:     "Mahlio Premium ist für euren Haushalt aktiv",
			TextBody:    "Hallo,\n\nMahlio Premium ist jetzt fuer euren Haushalt aktiv.\nDamit bleiben Woche, Rezepte und Einkauf in einem durchgehenden Fluss.\nAktuell freuen wir uns im Gegenzug ueber ehrliches Feedback direkt aus der App.\n\nZur App:\n{{app_url}}\n\nRueckfragen:\n{{support_email}}",
			HTMLBody:    "<p>Hallo,</p><p>Mahlio Premium ist jetzt fuer euren Haushalt aktiv.</p><p>Damit bleiben Woche, Rezepte und Einkauf in einem durchgehenden Fluss.</p><p>Aktuell freuen wir uns im Gegenzug ueber ehrliches Feedback direkt aus der App.</p><p><a href=\"{{app_url}}\">Zur App</a></p><p>Rueckfragen: {{support_email}}</p>",
			Description: "Mail beim Freischalten eines Premium-Haushalts.",
			Variables:   []string{"{{app_url}}", "{{support_email}}"},
		}, true
	case TemplateKindWeeklyPlanReady:
		return TemplateDefaults{
			Label:       "Wochenplan fertig",
			Subject:     "Euer Mahlio-Wochenplan ab {{week_start}} ist da",
			TextBody:    "Hallo {{family_name}},\n\neuer neuer Mahlio-Wochenplan ab {{week_start}} ist bereit.\nRezepte, Woche und Einkauf sind abgestimmt und koennen direkt geprueft werden.\n\nPlan ansehen:\n{{plan_url}}\n\nRueckfragen:\n{{support_email}}",
			HTMLBody:    "<p>Hallo {{family_name}},</p><p>euer neuer Mahlio-Wochenplan ab <strong>{{week_start}}</strong> ist bereit.</p><p>Rezepte, Woche und Einkauf sind abgestimmt und koennen direkt geprueft werden.</p><p><a href=\"{{plan_url}}\">Plan ansehen</a></p><p>Rueckfragen: {{support_email}}</p>",
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
	return fmt.Sprintf("Komm zu %s auf %s", strings.TrimSpace(payload.FamilyName), brand.Name)
}

func premiumInviteSubject(_ PremiumInviteEmail) string {
	return brand.Name + " Premium ist fuer euren Haushalt aktiv"
}

func premiumInviteText(payload PremiumInviteEmail) string {
	var lines []string
	lines = append(lines, "Hallo,")
	lines = append(lines, "")
	lines = append(lines, brand.Name+" Premium ist jetzt fuer euren Haushalt aktiv.")
	lines = append(lines, "Damit bleiben Woche, Rezepte und Einkauf in einem durchgehenden Fluss.")
	lines = append(lines, "Aktuell freuen wir uns im Gegenzug ueber ehrliches Feedback direkt aus der App.")
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
		"<p>Hallo,</p><p>%s Premium ist jetzt fuer euren Haushalt aktiv.</p><p>Damit bleiben Woche, Rezepte und Einkauf in einem durchgehenden Fluss.</p><p>Aktuell freuen wir uns im Gegenzug ueber ehrliches Feedback direkt aus der App.</p><p><a href=\"%s\">Zur App</a></p><p>Rueckfragen: %s</p>",
		htmlText(brand.Name, brand.Name),
		htmlEscape(payload.FeedbackURL),
		htmlText(payload.SupportEmail, "-"),
	)
}

func inviteText(payload InviteEmail) string {
	var lines []string
	lines = append(lines, "Du bist zu "+brand.Name+" eingeladen.")
	if name := strings.TrimSpace(payload.FamilyName); name != "" {
		lines = append(lines, fmt.Sprintf("Haushalt: %s", name))
	}
	lines = append(lines, "")
	lines = append(lines, "Mit dem Annehmen der Einladung kommt dein Login in diesen gemeinsamen Bereich.")
	lines = append(lines, "Woche, Rezepte und Einkauf liegen dort an einem Ort.")
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
		"<p>Du bist zu %s eingeladen.</p><p><strong>Haushalt:</strong> %s</p><p>Mit dem Annehmen der Einladung kommt dein Login in diesen gemeinsamen Bereich. Woche, Rezepte und Einkauf liegen dort an einem Ort.</p><p>%s</p><p><a href=\"%s\">Einladung annehmen</a></p><p>Rueckfragen: %s</p>",
		htmlText(brand.Name, brand.Name),
		htmlText(payload.FamilyName, brand.Name),
		htmlText(payload.WarningText, "Dein Profil wird beim Annehmen sinnvoll zusammengefuehrt."),
		htmlEscape(payload.InviteLink),
		htmlText(payload.SupportEmail, "-"),
	)
}

func weeklySubject(payload WeeklyPlanReadyEmail) string {
	return fmt.Sprintf("Euer %s-Wochenplan ab %s ist da", brand.Name, strings.TrimSpace(payload.WeekStart))
}

func weeklyText(payload WeeklyPlanReadyEmail) string {
	var lines []string
	if name := strings.TrimSpace(payload.FamilyName); name != "" {
		lines = append(lines, fmt.Sprintf("Hallo %s,", name))
	} else {
		lines = append(lines, "Hallo,")
	}
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("euer neuer %s-Wochenplan ab %s ist bereit.", brand.Name, strings.TrimSpace(payload.WeekStart)))
	lines = append(lines, "Rezepte, Woche und Einkauf sind abgestimmt und koennen direkt geprueft werden.")
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
		"<p>Hallo %s,</p><p>euer neuer %s-Wochenplan ab <strong>%s</strong> ist bereit.</p><p>Rezepte, Woche und Einkauf sind abgestimmt und koennen direkt geprueft werden.</p><p><a href=\"%s\">Plan ansehen</a></p><p>Rueckfragen: %s</p>",
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
