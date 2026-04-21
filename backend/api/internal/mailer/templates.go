package mailer

import (
	"fmt"
	"strings"
)

func inviteSubject(payload InviteEmail) string {
	if strings.TrimSpace(payload.FamilyName) == "" {
		return "Einladung zum Mealplanner"
	}
	return fmt.Sprintf("Einladung zum Mealplanner von %s", strings.TrimSpace(payload.FamilyName))
}

func inviteText(payload InviteEmail) string {
	var lines []string
	lines = append(lines, "Du wurdest zu einem Mealplanner-Familienkonto eingeladen.")
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
		"<p>Du wurdest zu einem Mealplanner-Familienkonto eingeladen.</p><p><strong>Familienkonto:</strong> %s</p><p>Mit dem Annehmen der Einladung wird dein persoenlicher Account in dieses Familienkonto ueberfuehrt.</p><p>%s</p><p><a href=\"%s\">Einladung annehmen</a></p><p>Rueckfragen: %s</p>",
		htmlText(payload.FamilyName, "Mealplanner"),
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
	lines = append(lines, fmt.Sprintf("dein neuer automatischer Mealplanner-Wochenplan ab %s ist fertig.", strings.TrimSpace(payload.WeekStart)))
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
		"<p>Hallo %s,</p><p>dein neuer automatischer Mealplanner-Wochenplan ab <strong>%s</strong> ist fertig.</p><p><a href=\"%s\">Plan ansehen</a></p><p>Rueckfragen: %s</p>",
		htmlText(payload.FamilyName, "Mealplanner"),
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
