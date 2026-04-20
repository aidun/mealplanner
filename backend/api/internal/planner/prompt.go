package planner

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
)

func WeekPrompt(profile domain.Profile, weekStart time.Time) string {
	body, _ := json.MarshalIndent(profile, "", "  ")
	return fmt.Sprintf(`Erstelle einen Wochen-Essensplan fuer eine Familie.

Woche startet am %s.

Regeln:
- Plane 7 Tage.
- Pro Tag Fruehstueck, Mittagessen und Abendessen.
- Snacks nur wenn Profile, Kalorienziel oder Alltagssinn dafuer sprechen.
- Ein gemeinsames Gericht pro Mahlzeit, Portionen pro Person skalieren.
- Jede Mahlzeit braucht Beschreibung, Zutaten, Anleitung und geschaetzte Naehrwerte.
- Beachte alle Vorlieben, Abneigungen und Einschraenkungen pro Person.
- Gib nur JSON im vereinbarten Schema zurueck.

Familienprofil:
%s`, weekStart.Format("2006-01-02"), string(body))
}

func RegeneratePrompt(profile domain.Profile, plan domain.Plan, mealID string, note string) string {
	cleanNote := strings.TrimSpace(note)
	body, _ := json.MarshalIndent(struct {
		Profile domain.Profile `json:"profile"`
		Plan    domain.Plan    `json:"plan"`
		MealID  string         `json:"mealId"`
		Note    string         `json:"note"`
	}{Profile: profile, Plan: plan, MealID: mealID, Note: cleanNote}, "", "  ")
	return fmt.Sprintf(`Erzeuge genau eine Ersatz-Mahlzeit fuer mealId %s.

Regeln:
- Erhalte Slot, Datumskontext und Familienlogik.
- Die Nutzer-Anmerkung ist verbindlich.
- Wenn die Anmerkung eine Zutat ausschliesst, darf sie weder in Titel, Zutaten noch Anleitung vorkommen.
- Wenn die Anmerkung Tempo, Kindertauglichkeit, Aufwand oder Stil nennt, muss das in Beschreibung, Zutaten und Anleitung sichtbar umgesetzt werden.
- Gib nur die einzelne Mahlzeit im vereinbarten JSON-Schema zurueck.

Nutzer-Anmerkung:
%s

Kontext:
%s`, mealID, cleanNote, string(body))
}
