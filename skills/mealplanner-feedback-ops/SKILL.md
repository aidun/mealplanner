---
name: mealplanner-feedback-ops
description: Nutze diesen Skill fuer Mealplanner-Feedback aus Admin oder App, wenn offene Rueckmeldungen gruppiert, priorisiert, zusammengefasst oder in umsetzbare Arbeit fuer Agenten und GitHub ueberfuehrt werden sollen.
---

# Mealplanner Feedback Ops

Nutze diesen Skill fuer offene Feedbacks und Produkt-/Support-Rueckmeldungen.

## Quellen

- Admin-Overview Feedback
- In-App Feedback
- direkte Owner-Kommentare

## Ziel

Aus rohen Feedbacks wird eine umsetzbare Arbeitsliste.

## Vorgehen

1. Sammle offene Feedbacks.
2. Gruppiere Dubletten nach Thema:
   - Navigation
   - Mobile Layout
   - Planergebnis
   - Invite / Mail
   - Premium / Admin
   - Performance / Stabilitaet
3. Gib jedem Thema:
   - Schweregrad
   - Häufigkeit
   - betroffene Oberfläche
   - vermutete Fachrolle
4. Trenne:
   - Bug
   - Supportfall
   - Produktwunsch
   - Betriebsproblem

## Priorisierung

- `P1`: blockiert Kernnutzung oder betrifft Production direkt
- `P2`: spuerbare Reibung oder haeufiges Feedback
- `P3`: sinnvoll, aber nicht akut

## Ausgabeschema

- Thema
- Typ
- Prioritaet
- Umgebung
- betroffene Flaeche
- naechster Bearbeiter
- ob GitHub-Issue sinnvoll ist

## Grenzen

- Feedback nicht als geloest markieren, wenn keine echte Verifikation vorliegt
- Keine Nutzerzitate mit sensiblen Daten uebernehmen
