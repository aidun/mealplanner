# Support Workflow

Stand: 2026-04-23

Diese Seite beschreibt den aktuellen Support- und Diagnose-Workflow fuer `mealplanner`.
Er basiert nicht auf einem separaten lokalen Agentenmodell, sondern auf dem globalen Codex-System
plus den repo-lokalen Support-Skills.

## Ziel

- Nutzerprobleme sauber triagieren
- Test und Production strikt trennen
- vorhandene read-only Betriebswerkzeuge nutzen
- notwendige Code-, UI-, Sicherheits- oder Rollout-Arbeit an die richtigen globalen Rollen geben

## Rollen im aktuellen System

- `Atlas`: nimmt den Fall auf, setzt Scope und weist die passenden Rollen zu
- `Shield`: verpflichtend bei personenbezogenen Daten, Sessions, Mail oder Production-Exposure
- `Forge`: API-, Planer-, Mail- oder Datenlogik
- `Nova` und `Flux`: UI-/UX-/Frontend-Faelle
- `Orbit`: Rollout-, GHCR-, Argo-, Tunnel- oder Cluster-Themen
- `Probe`: reproduziert und verifiziert den Nutzerfall
- `Gate`: Pflicht-Gate vor Test-Rollout
- `Quill`: aktualisiert Doku und Memory, wenn der Fall dauerhafte Konsequenzen hat

## Lokale Support-Skills

- `skills/mealplanner-support-triage`
- `skills/mealplanner-env-safety`
- `skills/mealplanner-feedback-ops`
- `skills/mealplanner-support-playbook`

## Verfuegbare Werkzeuge

Heute direkt nutzbar:

- `kubernetes-readonly`
- `github`
- `playwright`
- bestehende Admin- und App-Flows

Moegliche spaetere Erweiterungen:

- eng geschnittene `mealplanner-*` MCPs fuer Support- oder Admin-Aufgaben

## Ablauf

1. Fall aufnehmen und sauber klassifizieren
2. Umgebung bestimmen: Test oder Production
3. `mealplanner-env-safety` anwenden
4. lesende Diagnose mit App-, GitHub-, Kubernetes- und Browserdaten
5. Reproduktion des Problems
6. Umsetzung durch die passenden globalen Rollen
7. Verifikation durch `Probe`
8. Review durch `Gate`
9. Test-Rollout nur ueber den definierten Repo-Rolloutpfad

## Harte Regeln

- Production ist standardmaessig read-only.
- Keine freien DB-Writes.
- Keine generischen Kubernetes-Schreibrechte in Production.
- Keine Secrets oder Roh-Credentials in Tickets, Memory oder Repo-Doku.
- Test darf fuer Reproduktion und verifizierte Support-Aktionen gezielt veraendert werden.
