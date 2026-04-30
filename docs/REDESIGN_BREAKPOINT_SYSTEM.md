# Mahlio Redesign Breakpoint System

Stand: 2026-04-23

Dieses Dokument uebersetzt den laufenden Stitch-Neuentwurf in ein verbindliches
Breakpoint- und Flaechensystem fuer die spaetere repo-native Umsetzung.

Es geht bewusst nicht um einzelne Screenshots, sondern um die Regeln, die ueber
Desktop, Tablet und Handy hinweg stabil bleiben muessen.

## Zielbild

- `Mahlio` soll sich wie eine warme gemeinsame Wochenkueche anfuehlen, nicht wie ein technisches Familien-Dashboard.
- Der Kern bleibt funktional am aktuellen Produkt orientiert:
  - Woche planen
  - Rezepte oeffnen
  - Einkauf mitnehmen
- Die gestalterische Richtung wird aber ganzheitlich neu gedacht:
  - warm
  - kulinarisch
  - ruhig
  - editorial
  - premium, aber praktisch

## Geraeteklassen

### Desktop

- Zielkontext:
  - Ruhe
  - Planung mit Uebersicht
  - paralleler Kontext
- Interaktionshaltung:
  - vergleichen
  - draggen oder gezielt umplanen
  - Woche und Details gleichzeitig sehen
- Layoutprinzip:
  - dominante Hauptflaeche plus ruhiger Sekundaerkontext

### Tablet

- Zielkontext:
  - gemeinsames Planen am Tisch
  - Touch statt Maus
  - geteilte Aufmerksamkeit
- Interaktionshaltung:
  - tippen
  - gemeinsam abstimmen
  - zwischen Planung und Einkauf wechseln
- Layoutprinzip:
  - 1 bis 1.5 Zonen
  - weniger Gleichzeitigkeit als Desktop
  - staerkere Stapelung

### Handy

- Zielkontext:
  - unterwegs
  - in der Kueche
  - im Supermarkt
- Interaktionshaltung:
  - einhaendig
  - schnell
  - fokussiert
- Layoutprinzip:
  - keine geschrumpfte Desktop-Grid
  - klare vertikale Fuehrung
  - schnelle Einzelaktionen

## Visuelles System

- Basisflaeche:
  - warme Creme statt hartem Weiss
- Strukturfarben:
  - Olive und Salbei
- Signalakzent:
  - Tomate oder Terracotta nur sparsam
- Typografie:
  - `Newsreader` fuer Brand-, Rezept- und Ueberschriftsmomente
  - `Plus Jakarta Sans` fuer produktive Nutzung
- Materialitaet:
  - mehr Journal und Kuechentisch
  - weniger SaaS-Chrome
- Trennung:
  - keine dicken Linien
  - Flaechenschichtung, Abstand und Tonwerte statt Border-Rahmen

## Globale Produktregeln

- Marke zuerst:
  - `Mahlio` muss auf Einstiegsflaechen die lauteste Ebene bleiben.
- Woche zuerst:
  - die Wochenplanung ist fachlich der Kern und muss auf allen Breakpoints frueh lesbar sein.
- Rezept und Einkauf gehoeren sichtbar zur Planung:
  - keine isolierten Teilprodukte
- Copy bleibt warm, kurz und produktnah:
  - keine technische Selbstbeschreibung
  - keine generische Marketing-Sprache

## Flaechenlogik pro Bereich

### Einstieg / Login

#### Desktop

- posterhafte asymmetrische Hero-Komposition
- Marke, Headline und primaere Anmeldung links oder in ruhiger Textzone
- echte Produktvorschau gross genug, um Woche, Rezept und Einkauf anzudeuten

#### Tablet

- dieselbe Markenwirkung, aber kompakter
- CTA frueh sichtbar
- Produktvorschau staerker unter oder neben dem Einstieg gebuendelt

#### Handy

- Marke und Headline in einem Blick erfassbar
- Google-CTA frueh
- Apple darunter als klare Sekundaeraktion
- kompakte appetitliche Vorschau statt kleiner UI-Mikroteile

### Wochenplanung

#### Desktop

- dominante Wochenflaeche als Hauptarbeitsbereich
- Rezept- oder Einkaufs-Kontext daneben
- keine KPI-Kacheln, kein Dashboard-Mosaik

#### Tablet

- Woche bleibt Hauptflaeche
- Kontext klappt in Drawer, Bottom Sheet oder nachgelagerte Sektion
- Touch-Ziele groesser als auf Desktop

#### Handy

- week-first, aber nicht als enge 7-Spalten-Ansicht
- Tagesnavigation, vertikale Sequenz oder fokussierte Tagesansicht
- schnelle Rezept- und Einkaufsaktionen direkt an den Mahlzeiten

### Rezeptdetail

#### Desktop

- grosse appetitliche Hero-Flaeche
- Zutaten und Schritte klar getrennt
- Planungsaktion sichtbar integriert
- Einkauf und Portionen direkt anschlussfaehig

#### Tablet

- gleiche Rezeptlogik mit staerkerem Stack
- Zutaten und Schritte duerfen untereinander liegen
- Aktionszone gross und touchbar

#### Handy

- klare vertikale Kochansicht
- grosse Schrift, starke Touch-Ziele
- Zutaten, Schritte und Aktionen nicht in Karten zerlegen

### Einkauf

#### Desktop

- nur wenn spaeter noetig:
  - breitere Planungs- und Einkaufskoordination
  - eher Organisationssicht als Supermarktmodus

#### Tablet

- zweizonig sinnvoll:
  - Liste
  - Wochenkontext oder Pantry-Status
- gut fuer gemeinsamen Abgleich am Tisch

#### Handy

- Einkaufsmodus ist utilitaristisch am klarsten
- grosse Checkboxen
- Gruppierung nach Bereich
- Fortschritt, Meal-Bezug und Quick Add direkt sichtbar

## Navigationsregeln

- Desktop:
  - ruhige Top-Navigation oder Seitenstruktur mit klarer Hauptflaeche
- Tablet:
  - reduzierte Hauptnavigation
  - keine ueberladenen Mehrfachleisten
- Handy:
  - wenige Kernpunkte
  - Bottom Navigation nur fuer echte Top-Level-Bereiche
  - keine zusaetzliche Tab-Bar-Flut im oberen Bereich

## Interaktionsregeln

- Desktop:
  - mehr paralleler Kontext erlaubt
- Tablet:
  - Touch zuerst denken
  - Drawer, Sheets und Segmentwechsel sind plausibel
- Handy:
  - eine klare Hauptaktion pro Zone
  - einhaendig erreichbar
  - sofort scanbar

## Was vermieden werden muss

- geschrumpfte Desktop-Layouts auf Handy
- Kachel-Dashboards als Startpunkt der Produktarbeit
- uebermaessige Border- und Card-Systeme
- mehrere starke Akzentfarben gleichzeitig
- dicht gepackte Toolbar-Reihen
- kleine, decorative UI-Teile ohne Nutzwert

## Aktueller Stitch-Handoff

Im laufenden Stitch-Projekt liegen bisher diese Kernflaechen vor:

- Einstieg Desktop
- Einstieg Mobile
- Wochenplanung Desktop
- Wochenplanung Tablet
- Wochenplanung Mobile
- Rezeptdetail Desktop
- Rezeptdetail Mobile
- Einkauf Tablet
- Einkauf Mobile

Diese Entwuerfe sind Inspirations- und Handoff-Material. Source of Truth bleiben
spaeter Repo-Code, echte responsive Umsetzung und Verifikation auf Desktop, Tablet
und Handy.
