---
name: mealplanner-support-triage
description: Nutze diesen Skill fuer Supportfaelle in Mealplanner, wenn Nutzerfeedback, Admin-Hinweise oder Owner-Anweisungen zuerst sauber in UI, Daten, API, Betrieb oder Produktwunsch eingeordnet werden muessen.
---

# Mealplanner Support Triage

Nutze diesen Skill, wenn ein Supportfall zuerst klar klassifiziert werden muss, bevor Code, Daten oder Betrieb angefasst werden.

## Ziel

Ordne jeden Fall zuerst in genau eine Primaerkategorie ein:

- `ui-ux`
- `data-state`
- `api-business`
- `ops-release`
- `product-feedback`

Sekundaerkategorien sind erlaubt, aber nur nach der Primaerkategorie.

## Eingänge

Typische Eingänge:

- Feedback aus der App
- Hinweise aus dem Admin-Bereich
- direkte Owner-Anweisungen
- Test-vs-Production-Abweichungen

## Vorgehen

1. Formuliere das beobachtete Problem in einem Satz.
2. Nenne betroffene Umgebung:
   - lokal
   - test
   - production
3. Nenne betroffene Oberfläche oder Funktion:
   - Dashboard
   - Onboarding
   - Admin
   - Mail
   - Invite
   - Planer
4. Ordne die Primaerkategorie zu.
5. Leite die naechste passende Rolle ab:
   - `ui-ux` -> Product & UX Designer, Frontend Engineer
   - `data-state` -> Backend & AI Engineer, Data & Admin Insights
   - `api-business` -> Backend & AI Engineer
   - `ops-release` -> Platform & Release Engineer
   - `product-feedback` -> Product & UX Designer, Lead Engineer

## Ausgabeschema

Liefere knapp:

- Problem
- Umgebung
- Kategorie
- Betroffene Bereiche
- Empfohlene naechste Rolle
- Risiko fuer Nutzer

## Stop-Regeln

- Keine Produktionsmutation in dieser Phase
- Keine Vermutung als Fakt ausgeben
- Wenn Logs, Daten oder Reproduktion fehlen: als `ungeklärt` markieren
