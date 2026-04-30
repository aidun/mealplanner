package planner

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
)

// promptProfile is the privacy-minimized profile shape sent to the model.
type promptProfile struct {
	Household       string               `json:"household"`
	Members         []promptMember       `json:"members"`
	Defaults        domain.MealDefaults  `json:"defaults"`
	Presets         []string             `json:"presets,omitempty"`
	Notes           string               `json:"notes,omitempty"`
	PreferredStores string               `json:"preferredStores,omitempty"`
	ShoppingNotes   string               `json:"shoppingNotes,omitempty"`
	Appliances      []string             `json:"appliances,omitempty"`
	MealPlan        []promptDaySlotRules `json:"mealPlan,omitempty"`
}

type promptFavorite struct {
	Title       string   `json:"title"`
	Slot        string   `json:"slot,omitempty"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

type promptMember struct {
	ID             string   `json:"id"`
	Alias          string   `json:"alias,omitempty"`
	Role           string   `json:"role,omitempty"`
	AgeGroup       string   `json:"ageGroup,omitempty"`
	CaloriesTarget int      `json:"caloriesTarget,omitempty"`
	Presets        []string `json:"presets,omitempty"`
	Likes          string   `json:"likes,omitempty"`
	Dislikes       string   `json:"dislikes,omitempty"`
	Restrictions   string   `json:"restrictions,omitempty"`
}

type promptSlotRule struct {
	Slot         string   `json:"slot"`
	Participants []string `json:"participants,omitempty"`
}

type promptDaySlotRules struct {
	Day   string           `json:"day"`
	Slots []promptSlotRule `json:"slots,omitempty"`
}

type promptPlanContext struct {
	WeekStart     string              `json:"weekStart"`
	TargetMeal    promptMealDetail    `json:"targetMeal"`
	ExistingMeals []promptMealSummary `json:"existingMeals"`
}

type promptMealDetail struct {
	ID                 string              `json:"id"`
	Slot               string              `json:"slot"`
	Title              string              `json:"title"`
	Description        string              `json:"description"`
	Ingredients        []domain.Ingredient `json:"ingredients"`
	Instructions       []string            `json:"instructions"`
	Nutrition          domain.Nutrition    `json:"nutrition"`
	Tags               []string            `json:"tags"`
	Warnings           []string            `json:"warnings,omitempty"`
	EstimatedNutrition bool                `json:"estimatedNutrition"`
}

type promptMealSummary struct {
	Date  string   `json:"date"`
	Slot  string   `json:"slot"`
	Title string   `json:"title"`
	Tags  []string `json:"tags,omitempty"`
}

// WeekPrompt describes the week-generation contract and includes only minimized profile/favorite data.
func WeekPrompt(profile domain.Profile, weekStart time.Time, favorites []domain.FavoriteRecipe) string {
	body, _ := json.MarshalIndent(minimizeProfile(profile), "", "  ")
	favoriteBody, _ := json.MarshalIndent(minimizeFavorites(favorites), "", "  ")
	slotRuleText := strings.Join(humanDaySlotLabels(profile), "; ")
	return fmt.Sprintf(`Erstelle einen Wochen-Essensplan für eine Familie.

Woche startet am %s.

Regeln:
- Plane 7 Tage.
- Plane pro Wochentag nur diese aktivierten Mahlzeiten: %s.
- Generiere an keinem Tag deaktivierte Mahlzeiten.
- Ein gemeinsames Gericht pro Mahlzeit, Portionen pro Person skalieren.
- Pro Mahlzeit nur für die hinterlegten Teilnehmenden des jeweiligen Wochentags planen und Portionen nur für diese Personen ausgeben.
- Jede Mahlzeit braucht Beschreibung, Zutaten, Anleitung und geschätzte Nährwerte pro Portion.
- Beachte alle Vorlieben, Abneigungen und Einschränkungen pro Person.
- Beachte bevorzugte Einkaufsläden, typische Verpackungsgrößen und Einkaufsnotizen aus dem Profil.
- Nutze die hinterlegten Küchengeräte, wenn sie sinnvoll passen; erfinde keine vorausgesetzten Spezialgeräte.
- Plane Zutaten so, dass angebrochene Packungen möglichst über Folgetage verbraucht werden und nicht als Einzelreste stehen bleiben.
- Nutze Favoriten als Inspiration. Wiederhole passende Favoriten oder Varianten davon, aber mache die Woche nicht monoton.
- Wenn Favoriten gut passen, übernimm mindestens 2 Mahlzeiten der Woche direkt daraus oder als klar erkennbare Variante.
- Gib nur JSON im vereinbarten Schema zurück.

Familienprofil:
%s

Favoriten:
%s`, weekStart.Format("2006-01-02"), slotRuleText, string(body), string(favoriteBody))
}

// RegeneratePrompt gives the model one target meal plus surrounding context, not the whole raw account state.
func RegeneratePrompt(profile domain.Profile, plan domain.Plan, mealID string, note string, favorites []domain.FavoriteRecipe) string {
	cleanNote := strings.TrimSpace(note)
	body, _ := json.MarshalIndent(struct {
		Profile   promptProfile     `json:"profile"`
		Plan      promptPlanContext `json:"plan"`
		MealID    string            `json:"mealId"`
		Note      string            `json:"note"`
		Favorites []promptFavorite  `json:"favorites,omitempty"`
	}{Profile: minimizeProfile(profile), Plan: minimizePlanContext(plan, mealID), MealID: mealID, Note: cleanNote, Favorites: minimizeFavorites(favorites)}, "", "  ")
	return fmt.Sprintf(`Erzeuge genau eine Ersatz-Mahlzeit für mealId %s.

Regeln:
- Erhalte Slot, Datumskontext und Familienlogik.
- Die Nutzer-Anmerkung ist verbindlich.
- Wenn die Anmerkung eine Zutat ausschließt, darf sie weder in Titel, Zutaten noch Anleitung vorkommen.
- Wenn die Anmerkung Tempo, Kindertauglichkeit, Aufwand oder Stil nennt, muss das in Beschreibung, Zutaten und Anleitung sichtbar umgesetzt werden.
- Favoriten dürfen als Stil- oder Rezeptvorlage dienen, wenn sie zur Anmerkung passen.
- Wenn die Anmerkung offen bleibt, prüfe zuerst passende Favoriten oder nahe Varianten daraus.
- Nährwerte sind pro Portion anzugeben.
- Beachte Einkaufsnotizen, Verpackungsgrößen und vorhandene Wochenzutaten aus dem Profilkontext.
- Gib nur die einzelne Mahlzeit im vereinbarten JSON-Schema zurück.

Nutzer-Anmerkung:
%s

Kontext:
%s`, mealID, cleanNote, string(body))
}

// MergeProfilePrompt asks for a cooking-profile merge and explicitly excludes login/account invention.
func MergeProfilePrompt(target domain.Profile, incoming domain.Profile) string {
	body, _ := json.MarshalIndent(struct {
		Target   promptProfile `json:"targetFamilyProfile"`
		Incoming promptProfile `json:"incomingPersonalProfile"`
	}{Target: minimizeProfile(target), Incoming: minimizeProfile(incoming)}, "", "  ")
	return fmt.Sprintf(`Mische zwei Familienprofile zu einem gemeinsamen Mealplanner-Profil.

Regeln:
- Bewahre Personen, Vorlieben, Abneigungen, Einschränkungen und Kalorienziele sinnvoll.
- Löse Dopplungen pragmatisch auf.
- Keine Login-Daten, E-Mail-Adressen oder Namen erfinden.
- Gib nur das gemeinsame Profil im vereinbarten JSON-Schema zurück.

Kontext:
%s`, string(body))
}

// minimizeProfile removes real member names and truncates free text before model calls.
func minimizeProfile(profile domain.Profile) promptProfile {
	members := make([]promptMember, 0, len(profile.Members))
	for i, member := range profile.Members {
		members = append(members, promptMember{
			ID:             fmt.Sprintf("person-%d", i+1),
			Alias:          trimPromptText(preferredAlias(member), 80),
			Role:           trimPromptText(member.Role, 80),
			AgeGroup:       ageGroup(member.Age),
			CaloriesTarget: member.CaloriesTarget,
			Presets:        member.Presets,
			Likes:          trimPromptText(member.Likes, 300),
			Dislikes:       trimPromptText(member.Dislikes, 300),
			Restrictions:   trimPromptText(member.Restrictions, 300),
		})
	}
	dayRules := make([]promptDaySlotRules, 0, len(weekdayConfig))
	for _, weekday := range weekdayConfig {
		slotRules := make([]promptSlotRule, 0, len(mealSlotConfig))
		for _, rule := range planningRulesForDay(profile, weekday.Key) {
			if !rule.Enabled {
				continue
			}
			participants := participantsForSlotOnDay(profile, rule.Slot, weekday.Key)
			labels := make([]string, 0, len(participants))
			for _, member := range participants {
				label := preferredAlias(member)
				if label != "" {
					labels = append(labels, label)
				}
			}
			slotRules = append(slotRules, promptSlotRule{
				Slot:         rule.Slot,
				Participants: labels,
			})
		}
		dayRules = append(dayRules, promptDaySlotRules{
			Day:   weekday.Title,
			Slots: slotRules,
		})
	}
	return promptProfile{
		Household:       "privater Haushalt",
		Members:         members,
		Defaults:        profile.Defaults,
		Presets:         profile.Presets,
		Notes:           trimPromptText(profile.Notes, 500),
		PreferredStores: trimPromptText(profile.PreferredStores, 300),
		ShoppingNotes:   trimPromptText(profile.ShoppingNotes, 500),
		Appliances:      trimPromptList(profile.Appliances, 12, 80),
		MealPlan:        dayRules,
	}
}

func humanDaySlotLabels(profile domain.Profile) []string {
	out := make([]string, 0, len(weekdayConfig))
	for _, weekday := range weekdayConfig {
		labels := humanSlotLabels(enabledSlotsForDay(profile, weekday.Key))
		if len(labels) == 0 {
			labels = []string{"keine"}
		}
		out = append(out, fmt.Sprintf("%s: %s", weekday.Title, strings.Join(labels, ", ")))
	}
	return out
}

func humanSlotLabels(slots []string) []string {
	if len(slots) == 0 {
		return nil
	}
	out := make([]string, 0, len(slots))
	for _, slot := range slots {
		switch slot {
		case "breakfast":
			out = append(out, "Frühstück")
		case "lunch":
			out = append(out, "Mittagessen")
		case "dinner":
			out = append(out, "Abendessen")
		case "snack":
			out = append(out, "Snack")
		}
	}
	return out
}

func preferredAlias(member domain.Member) string {
	if alias := strings.TrimSpace(member.Alias); alias != "" {
		return alias
	}
	return strings.TrimSpace(member.Name)
}

// minimizeFavorites keeps favorite context bounded so prompts stay useful and cheap.
func minimizeFavorites(favorites []domain.FavoriteRecipe) []promptFavorite {
	out := make([]promptFavorite, 0, len(favorites))
	for _, favorite := range favorites {
		meal := favorite.Meal
		title := strings.TrimSpace(meal.Title)
		if title == "" {
			continue
		}
		out = append(out, promptFavorite{
			Title:       trimPromptText(title, 120),
			Slot:        trimPromptText(meal.Slot, 40),
			Description: trimPromptText(meal.Description, 240),
			Tags:        meal.Tags,
		})
		if len(out) >= 10 {
			break
		}
	}
	return out
}

// minimizePlanContext includes the target recipe and compact titles for neighboring meals.
func minimizePlanContext(plan domain.Plan, mealID string) promptPlanContext {
	context := promptPlanContext{WeekStart: plan.WeekStart}
	for _, day := range plan.Days {
		for _, meal := range day.Meals {
			if meal.ID == mealID {
				context.TargetMeal = promptMealDetail{
					ID:                 meal.ID,
					Slot:               meal.Slot,
					Title:              meal.Title,
					Description:        meal.Description,
					Ingredients:        meal.Ingredients,
					Instructions:       meal.Instructions,
					Nutrition:          meal.Nutrition,
					Tags:               meal.Tags,
					Warnings:           meal.Warnings,
					EstimatedNutrition: meal.EstimatedNutrition,
				}
			}
			context.ExistingMeals = append(context.ExistingMeals, promptMealSummary{
				Date:  day.Date,
				Slot:  meal.Slot,
				Title: meal.Title,
				Tags:  meal.Tags,
			})
		}
	}
	return context
}

func ageGroup(age int) string {
	switch {
	case age <= 0:
		return ""
	case age < 3:
		return "Kleinkind"
	case age < 13:
		return "Kind"
	case age < 18:
		return "Teenager"
	default:
		return "Erwachsen"
	}
}

func trimPromptText(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return strings.TrimSpace(value[:limit])
}

func trimPromptList(values []string, maxItems int, limit int) []string {
	if len(values) == 0 || maxItems == 0 {
		return nil
	}
	out := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		trimmed := trimPromptText(value, limit)
		key := strings.ToLower(trimmed)
		if trimmed == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, trimmed)
		if maxItems > 0 && len(out) >= maxItems {
			break
		}
	}
	return out
}
