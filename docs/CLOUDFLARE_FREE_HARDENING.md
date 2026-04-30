# Cloudflare Free Hardening

Stand: 2026-04-21

Diese App laeuft oeffentlich ueber `mealplanner.markushartmann.dev` und einen
Cloudflare Tunnel. Der kostenlose Plan deckt einen sinnvollen Basisschutz ab,
aber nicht alle Cloudflare-Sicherheitsfunktionen.

Diese Datei beschreibt nur Massnahmen, die im Free-Modell enthalten sind oder
ohne kostenpflichtige Features sauber betrieben werden koennen.

## Ausgangslage

- Externer Traffic laeuft ueber Cloudflare Tunnel zu `entrypoint`.
- Die Origin-IP soll nicht oeffentlich exponiert werden.
- Bring-Export-Links bleiben absichtlich oeffentlich erreichbar und duerfen
  nicht hinter Cloudflare Access gelegt werden.
- Das Backend hat bereits eigenes App-Rate-Limiting fuer sensible Pfade, was
  die kostenlose Cloudflare-Schicht sinnvoll ergaenzt.

## Im Free-Plan aktivieren

### 1. DNS und Proxying

- Zone `markushartmann.dev` muss vollstaendig bei Cloudflare liegen.
- Das fuer `mealplanner.markushartmann.dev` verwendete Ziel muss ueber den
  Tunnel veroeffentlicht werden, damit Requests durch die Cloudflare-Edge
  laufen.
- Direkte Origin-Erreichbarkeit aus dem Internet vermeiden. Der Tunnel ist der
  bevorzugte oeffentliche Einstiegspunkt.

### 2. SSL/TLS

- SSL/TLS-Modus auf `Full` oder, falls sauber moeglich, `Full (strict)` setzen.
- `Always Use HTTPS` aktivieren.
- `Automatic HTTPS Rewrites` aktivieren.
- Keine HTTP-Only-Oeffnung fuer die App belassen.

### 3. WAF Managed Rules

- Das kostenlose Cloudflare Managed Ruleset aktivieren.
- Aktion fuer das Free Managed Ruleset zunaechst auf den sicheren Standard
  belassen.
- Nach Aktivierung Security Events auf False Positives fuer `/api/*`,
  Google-OAuth-Flows und Bring-Export pruefen.

### 4. Security Level und Bots

- `Security Level` mindestens auf `Medium` setzen.
- `Bot Fight Mode` aktivieren, solange kein legitimer Traffic dadurch gestoert
  wird.

### 5. IP Access Rules

- Einzelne offensichtliche Stoerquellen koennen kostenlos ueber IP Access Rules
  blockiert werden.
- Keine breite Geoblocking-Strategie einplanen; das ist im Free-Plan nicht als
  eigene Komfortfunktion enthalten.

### 6. Rate Limiting

- Mindestens eine kostenlose Rate-Limiting-Regel fuer den sensibelsten Pfad
  anlegen:
  - Pfad-Vorschlag: `/api/auth/*`
  - Ziel: Login- und Callback-bezogenen Missbrauch frueh drosseln
- Weitere API-Drosselung bleibt primär Aufgabe des App-Rate-Limits im Backend,
  weil der Free-Plan nur sehr begrenzte Rule-Kapazitaet bietet.

### 7. Security Headers

- `X-Frame-Options`, `X-Content-Type-Options` und HSTS weiter in der App
  ausliefern; Cloudflare ersetzt die Applikations-Header-Strategie nicht.
- Falls spaeter Cloudflare Transform/Response Header Rules genutzt werden, nur
  ergaenzend und nicht als Ersatz fuer die App-Haertung.

## Bewusst nicht fuer Free eingeplant

- Cloudflare Access vor der kompletten App:
  wuerde den oeffentlichen Bring-Export-Flow brechen und ist fuer die aktuelle
  Produktlogik nicht passend.
- Erweiterte WAF-Custom-Rules als Hauptschutzkonzept:
  moeglich nur eingeschraenkt und nicht als belastbares Gratis-Designziel.
- Umfangreiche Rate-Limiting-Matrix fuer viele API-Pfade:
  der Free-Plan ist dafuer zu knapp.
- Zone Lockdown als Kernmechanismus:
  nicht im Free-Plan verfuegbar.
- Bot Management:
  nicht im Free-Plan enthalten.

## Empfohlene kostenlose Minimal-Konfiguration

Wenn nur das noetigste aktiviert werden soll:

1. Tunnel weiter als einzigen oeffentlichen Einstiegspunkt nutzen.
2. SSL/TLS auf `Full (strict)` bringen, falls Zertifikatskette sauber ist,
   sonst vorerst `Full`.
3. `Always Use HTTPS` aktivieren.
4. Cloudflare Free Managed Ruleset aktivieren.
5. `Bot Fight Mode` aktivieren.
6. `Security Level = Medium`.
7. Eine Rate-Limiting-Regel auf `/api/auth/*`.
8. Security Events nach dem Einschalten 24-48 Stunden pruefen.

## Pruefpunkte nach Aktivierung

- Google Login funktioniert weiter.
- Session- und CSRF-geschuetzte API-Calls funktionieren weiter.
- `GET /api/plans/{id}/bring-export` und Bring-Import funktionieren weiter.
- Keine unerwarteten WAF-Blocks fuer legitime App-Requests.
- Keine Loops oder TLS-Fehler am Tunnel/Entrypoint.

## Operativer Hinweis

Cloudflare war in der aktuellen Codex-Session nicht authentisiert. Deshalb
wurde hier nur die Betriebsdoku konkretisiert, aber keine Zone-Einstellung
direkt per API veraendert.
