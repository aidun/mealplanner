---
name: mealplanner-env-safety
description: Nutze diesen Skill fuer Mealplanner-Support oder Diagnosearbeit, wenn zwischen Test und Production unterschieden werden muss und Aktionen nur innerhalb des richtigen Sicherheitsrahmens passieren duerfen.
---

# Mealplanner Environment Safety

Nutze diesen Skill bei jeder Supportarbeit, die Test oder Production beruehrt.

## Grundregel

Test ist die Reproduktions- und Reparaturumgebung.
Production ist standardmaessig Diagnose-only.

## Erlaubt in Test

- Reproduktion von Nutzerproblemen
- Playwright-Pruefungen
- Admin-Feedback-Triage
- Rollout-Vorbereitung
- gezielte, freigegebene Test-Rollouts

## Erlaubt in Production

- Lesen von oeffentlichem Verhalten
- Lesen von Rollout- und Clusterzustand ueber read-only Tools
- Lesen von GitHub-/CI-/Deploy-Status
- Lesen von Admin-/Feedback-Kontext, sofern datenschutzkonform

## Nicht erlaubt in Production

- freie DB-Änderungen
- freie Kubernetes-Schreibaktionen
- Secret-Zugriff
- unprotokollierte Nutzerzustands-Aenderungen

## Prüfpfad

Vor jeder Aktion:

1. Welche Umgebung ist betroffen?
2. Ist die Aktion read-only oder write?
3. Gibt es einen bestehenden sicheren Pfad ueber:
   - GitHub
   - Playwright
   - kubernetes-readonly
   - Admin-UI / vorhandene API
4. Wenn nicht: stoppen und als spaeteren MCP/API-Bedarf markieren.

## Ausgaberegel

Nenne immer explizit:

- betroffene Umgebung
- Risikoklasse: `read-only`, `low-risk`, `blocked`
- warum die Aktion erlaubt oder nicht erlaubt ist
