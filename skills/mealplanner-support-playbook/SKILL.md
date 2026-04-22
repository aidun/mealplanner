---
name: mealplanner-support-playbook
description: Nutze diesen Skill fuer wiederkehrende Mealplanner-Supportfaelle wie Mobile-Probleme, Invite-Mail, fehlende Wochenplaene, Test-vs-Production-Abweichungen oder Bring-Export, um immer denselben sicheren Ablauf zu fahren.
---

# Mealplanner Support Playbook

Nutze diesen Skill fuer wiederkehrende Supportfaelle mit klaren Diagnosepfaden.

## Standardablauf

1. Fall mit `mealplanner-support-triage` einordnen.
2. Umgebung mit `mealplanner-env-safety` absichern.
3. Vorhandene Quellen abfragen:
   - GitHub
   - kubernetes-readonly
   - Playwright
   - Admin-/Feedback-Kontext
4. Passende Fachrolle ziehen.
5. Ergebnis als:
   - Fix
   - Rollout
   - Feedback-Antwort
   - GitHub-Issue
   dokumentieren.

## Wiederkehrende Fälle

### Mobile/UI kaputt

- Reproduktion per Playwright
- Breakpoints explizit pruefen
- Frontend Engineer + Product & UX Designer

### Wochenplan fehlt oder wirkt falsch

- Planzustand und API-Verhalten pruefen
- Test vs. Production unterscheiden
- Backend & AI Engineer

### Invite / Mail kam nicht an

- Admin-/Mail-Kontext pruefen
- Deployment- und Mailpfad lesen
- Platform & Release Engineer + Security & Privacy Engineer

### Bring-Export defekt

- UI-Reproduktion
- API-/Link-Verhalten pruefen
- Backend & AI Engineer

### Test und Production verhalten sich unterschiedlich

- zuerst Environment-Safety
- dann Release-, Config- und Rollout-Differenzen pruefen
- Platform & Release Engineer

## Ergebnisformat

- Fall
- Reproduktion ja/nein
- Umgebung
- vermutete Ursache
- naechster Schritt
- benoetigter Agent
