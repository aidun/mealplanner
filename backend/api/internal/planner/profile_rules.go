package planner

import (
	"strings"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
)

type slotPlanRule struct {
	Slot      string
	Enabled   bool
	MemberIDs []string
}

var mealSlotConfig = []struct {
	Slot            string
	Title           string
	ParticipantHead string
}{
	{Slot: "breakfast", Title: "Frühstück", ParticipantHead: "Teilnehmende Frühstück"},
	{Slot: "lunch", Title: "Mittagessen", ParticipantHead: "Teilnehmende Mittagessen"},
	{Slot: "dinner", Title: "Abendessen", ParticipantHead: "Teilnehmende Abendessen"},
	{Slot: "snack", Title: "Snack", ParticipantHead: "Teilnehmende Snack"},
}

func planningRules(profile domain.Profile) []slotPlanRule {
	sections := parseNoteSections(profile.Notes)
	active := normalizeTokenSet(splitRuleLines(sections["Aktive Mahlzeiten"]))
	memberLookup := map[string]domain.Member{}
	for _, member := range profile.Members {
		memberLookup[strings.ToLower(strings.TrimSpace(member.ID))] = member
	}

	rules := make([]slotPlanRule, 0, len(mealSlotConfig))
	for _, config := range mealSlotConfig {
		enabled := len(active) == 0 || active[config.Slot]
		participants := parseRuleMembers(splitRuleLines(sections[config.ParticipantHead]), memberLookup)
		rules = append(rules, slotPlanRule{
			Slot:      config.Slot,
			Enabled:   enabled,
			MemberIDs: participants,
		})
	}
	return rules
}

func enabledSlots(profile domain.Profile) []string {
	rules := planningRules(profile)
	out := make([]string, 0, len(rules))
	for _, rule := range rules {
		if rule.Enabled {
			out = append(out, rule.Slot)
		}
	}
	return out
}

func participantsForSlot(profile domain.Profile, slot string) []domain.Member {
	slot = strings.ToLower(strings.TrimSpace(slot))
	var matched *slotPlanRule
	for _, rule := range planningRules(profile) {
		if rule.Slot == slot {
			ruleCopy := rule
			matched = &ruleCopy
			break
		}
	}
	if matched == nil || len(matched.MemberIDs) == 0 {
		return append([]domain.Member(nil), profile.Members...)
	}
	memberByID := map[string]domain.Member{}
	for _, member := range profile.Members {
		memberByID[strings.ToLower(strings.TrimSpace(member.ID))] = member
	}
	out := make([]domain.Member, 0, len(matched.MemberIDs))
	for _, memberID := range matched.MemberIDs {
		if member, ok := memberByID[strings.ToLower(memberID)]; ok {
			out = append(out, member)
		}
	}
	if len(out) == 0 {
		return append([]domain.Member(nil), profile.Members...)
	}
	return out
}

func parseNoteSections(notes string) map[string]string {
	knownTitles := []string{
		"Standard-Portionen",
		"Kochstil",
		"Planungsregeln",
		"Ausgeschlossene Zutaten",
		"Aktive Mahlzeiten",
		"Teilnehmende Frühstück",
		"Teilnehmende Mittagessen",
		"Teilnehmende Abendessen",
		"Teilnehmende Snack",
	}
	sections := map[string]string{}
	var currentTitle string
	var currentLines []string

	flush := func() {
		if currentTitle != "" {
			sections[currentTitle] = strings.TrimSpace(strings.Join(currentLines, "\n"))
		}
	}

	for _, rawLine := range strings.Split(notes, "\n") {
		line := strings.TrimRight(rawLine, "\r")
		foundTitle := ""
		for _, title := range knownTitles {
			if line == title+":" {
				foundTitle = title
				break
			}
		}
		if foundTitle != "" {
			flush()
			currentTitle = foundTitle
			currentLines = currentLines[:0]
			continue
		}
		if currentTitle != "" {
			currentLines = append(currentLines, line)
		}
	}
	flush()
	return sections
}

func splitRuleLines(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.FieldsFunc(value, func(r rune) bool {
		return r == '\n' || r == ',' || r == ';'
	})
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func normalizeTokenSet(values []string) map[string]bool {
	if len(values) == 0 {
		return nil
	}
	out := map[string]bool{}
	for _, value := range values {
		key := strings.ToLower(strings.TrimSpace(value))
		switch key {
		case "fruehstueck", "frühstück":
			out["breakfast"] = true
		case "mittagessen":
			out["lunch"] = true
		case "abendessen":
			out["dinner"] = true
		case "snack", "snacks":
			out["snack"] = true
		case "breakfast", "lunch", "dinner":
			out[key] = true
		}
	}
	return out
}

func parseRuleMembers(values []string, memberLookup map[string]domain.Member) []string {
	if len(values) == 0 {
		return nil
	}
	out := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		key := strings.ToLower(strings.TrimSpace(value))
		if key == "" {
			continue
		}
		if member, ok := memberLookup[key]; ok {
			if !seen[member.ID] {
				seen[member.ID] = true
				out = append(out, member.ID)
			}
			continue
		}
		for _, member := range memberLookup {
			alias := strings.ToLower(strings.TrimSpace(member.Alias))
			name := strings.ToLower(strings.TrimSpace(member.Name))
			if key == alias || key == name {
				if !seen[member.ID] {
					seen[member.ID] = true
					out = append(out, member.ID)
				}
			}
		}
	}
	return out
}
