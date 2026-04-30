# Backend API

Diese Dokumentation beschreibt die HTTP-Schnittstelle der Mahlio-API auf fachlicher Ebene.
Sie ist die Referenz fuer Frontend, Admin-Workflow und Tests. Die API ist cookie-basiert, nutzt
CSRF-Schutz fuer mutierende Requests und antwortet im Fehlerfall mit sprechendem Text oder einem
JSON-Fehlerobjekt, falls der jeweilige Handler das bereits so liefert.

## Auth und Session

- Session: Cookie-basiert
- Mutierende Requests: `X-CSRF-Token` Pflicht
- Admin-Endpunkte: nur fuer `markush1986@gmail.com`
- Premium-Endpunkte: fuer Premium-Familien bzw. den Admin, sofern der jeweilige Handler ueber
  `withPremium` geschuetzt ist

### `GET /api/session`

Liefert die aktuelle Login-Session fuer das Frontend.

Antwort:

```json
{
  "authenticated": true,
  "userID": "user-1",
  "email": "anna@example.test",
  "isAdmin": false,
  "isPremium": true,
  "csrfToken": "csrf-token",
  "onboardingRequired": true
}
```

Hinweis:

- `onboardingRequired=true` gilt nur fuer den neutralen Erstzustand: Platzhalterprofil aktiv und
  der First-Login-Dialog wurde noch nicht uebersprungen.

### `POST /api/account/onboarding/skip`

Merkt sich, dass der First-Login-Dialog fuer den aktuellen Login-Account nicht erneut automatisch
erscheinen soll.

Antwort:

- `204 No Content`

## Admin

### `GET /api/admin/overview`

Liefert die Admin-Uebersicht mit Premium-Freigaben, Statistiken, Mail-Templates und Feedback.

Query-Parameter:

- `includeResolved=true`
  - optional
  - liefert zusaetzlich geloeste Feedback-Eintraege im Feld `resolvedFeedback`

Antwort:

```json
{
  "premiumUsers": [
    {
      "id": "premium-1",
      "email": "premium@example.test",
      "createdAt": "2026-04-22T08:00:00Z"
    }
  ],
  "feedback": [
    {
      "id": "feedback-1",
      "message": "Die Auswahl im Profil ist zu versteckt.",
      "page": "/onboarding",
      "status": "open",
      "createdAt": "2026-04-21T09:30:00Z"
    }
  ],
  "resolvedFeedback": [
    {
      "id": "feedback-2",
      "message": "Header auf Mobile verdichten.",
      "page": "/",
      "status": "resolved",
      "createdAt": "2026-04-20T09:30:00Z",
      "resolvedAt": "2026-04-21T10:30:00Z",
      "resolvedByUserId": "user-1"
    }
  ],
  "mailTemplates": [],
  "stats": {
    "averageActiveAccountsPerFamily": 1.5,
    "averageProfileMembersPerFamily": 2.5
  }
}
```

Hinweise:

- `feedback` enthaelt standardmaessig nur offene Eintraege.
- `resolvedFeedback` wird nur geliefert, wenn `includeResolved=true` gesetzt ist.

### `POST /api/admin/feedback/{feedbackID}/resolve`

Markiert einen offenen Feedback-Eintrag als geloest.

Pfad-Parameter:

- `feedbackID`
  - UUID oder String-ID des Feedback-Eintrags

Antwort:

```json
{
  "id": "feedback-1",
  "message": "Die Auswahl im Profil ist zu versteckt.",
  "page": "/onboarding",
  "status": "resolved",
  "createdAt": "2026-04-21T09:30:00Z",
  "resolvedAt": "2026-04-22T08:30:00Z",
  "resolvedByUserId": "user-1"
}
```

Fehler:

- `404`: Eintrag nicht gefunden oder bereits in einem nicht mehr mutierbaren Zustand
- `403`: kein Admin
- `401`: keine Session

### `POST /api/admin/premium-users`

Schaltet eine E-Mail-Adresse fuer Premium frei und kann optional direkt die Premium-Einladung per Mail senden.

Request:

```json
{
  "email": "premium@example.test",
  "sendInvite": true
}
```

Antwort:

```json
{
  "premiumUser": {
    "id": "premium-1",
    "email": "premium@example.test",
    "createdAt": "2026-04-22T08:00:00Z"
  },
  "emailSent": true
}
```

Fehler:

- `409`: Die E-Mail hat bereits Premium-Zugriff. Das gilt sowohl fuer direkte Eintraege in
  `premium_users` als auch fuer Logins, deren aktives Familienkonto bereits ueber einen anderen
  Familienlogin Premium hat. Der Admin-Login `markush1986@gmail.com` wird ebenfalls als bereits
  freigeschaltet behandelt.
- `403`: kein Admin
- `401`: keine Session

## Feedback

### `POST /api/feedback`

Speichert Premium-Feedback mit Seitenkontext.

Request:

```json
{
  "message": "Die Tagesauswahl braucht mehr Kontext.",
  "page": "/?meal=meal-1&day=2026-04-13"
}
```

Antwort:

```json
{
  "id": "feedback-new",
  "message": "Die Tagesauswahl braucht mehr Kontext.",
  "page": "/?meal=meal-1&day=2026-04-13",
  "status": "open",
  "createdAt": "2026-04-22T08:15:00Z"
}
```

Regeln:

- `message` ist Pflicht
- max. 2000 Zeichen
- `status` startet immer als `open`

## Profil

### `GET /api/profile`

Liefert das aktive Familien-Kuechenprofil oder `404`, wenn noch kein Profil gespeichert ist.

Wichtige Felder:

```json
{
  "householdName": "Familie Weber",
  "members": [],
  "defaults": {
    "breakfast": "schnell",
    "lunch": "vorbereitbar",
    "dinner": "warm",
    "snacks": "Obst"
  },
  "presets": ["familientauglich"],
  "notes": "Wochentags simpel",
  "appliances": ["Airfryer", "Thermomix", "OptiGrill"]
}
```

Hinweis:

- `appliances` beschreibt verfuegbare Kuechengeraete und fliesst in Wochen- und Einzelgericht-Prompts ein.

### `PUT /api/profile`

Speichert das aktive Familien-Kuechenprofil. Mutierender Request, daher mit `X-CSRF-Token`.

Antwort:

- `200 OK` mit dem gespeicherten Profil

## Planung

### `GET /api/plans/current`

Liefert den zuletzt gespeicherten Wochenplan der aktiven Familie oder `404`, wenn noch kein Plan existiert.

### `GET /api/plans?weekStart=YYYY-MM-DD`

Liefert den Wochenplan der aktiven Familie fuer die angegebene Woche.

Query-Parameter:

- `weekStart`
  - optional
  - wird auf den Montag der angegebenen Woche normalisiert
  - fehlt der Parameter, entspricht der Endpunkt `GET /api/plans/current`

Antwort:

- `200 OK` mit `Plan`
- `404`, wenn fuer diese Familie und Woche noch kein Plan existiert
- `400`, wenn `weekStart` nicht als Datum lesbar ist

### `POST /api/plans`

Erzeugt oder ersetzt einen Wochenplan. Mutierender Request, daher mit `X-CSRF-Token`.

Request:

```json
{
  "weekStart": "2026-05-04"
}
```

Hinweise:

- `weekStart` ist optional.
- Wenn `weekStart` gesetzt ist, wird das Datum auf den Montag dieser Woche normalisiert.
- Ohne `weekStart` plant das Backend die naechste Woche.

Antwort:

- `200 OK` mit dem gespeicherten `Plan`

### `POST /api/plans/{planID}/meals`

Erzeugt oder ersetzt genau ein Gericht fuer Tag und Mahlzeiten-Slot, ohne die gesamte Woche neu aufzubauen.
Mutierender Request, daher mit `X-CSRF-Token`.

Request:

```json
{
  "dayDate": "2026-05-04",
  "slot": "dinner",
  "note": "Airfryer und schnell"
}
```

Regeln:

- `dayDate` muss im Plan existieren und `YYYY-MM-DD` nutzen.
- `slot` akzeptiert `breakfast`, `lunch`, `dinner`, `snack` sowie die deutschen Entsprechungen.
- Existiert in diesem Slot bereits ein Gericht, wird es ersetzt; sonst wird ein neues Gericht an diesem Tag angelegt.
- Die Einkaufsliste wird nach dem Einzelvorschlag neu konsolidiert.

Antwort:

- `200 OK` mit dem aktualisierten `Plan`
- `400`, wenn Tag oder Slot ungueltig sind
- `404`, wenn der Plan nicht gefunden wurde

### `POST /api/plans/{planID}/meals/{mealID}/regenerate`

Ersetzt ein bestehendes Gericht ueber dessen `mealID`. Mutierender Request, daher mit `X-CSRF-Token`.

Request:

```json
{
  "note": "Bitte milder und schneller"
}
```

Antwort:

- `200 OK` mit dem aktualisierten `Plan`

## Familie

### `POST /api/family/invites`

Erzeugt eine Familien-Einladung fuer eine Ziel-Mailadresse und verschickt optional direkt die Einladungs-Mail.

Request:

```json
{
  "email": "person@example.test"
}
```

Antwort:

- `201 Created` mit `FamilyInvite`

Fehler:

- `409`: Das Zielkonto gehoert bereits zum aktuellen Familienkonto oder bereits zu einem anderen
  aktiven Familienkonto. Nur persoenliche Einzelkonten duerfen in ein anderes Familienkonto
  ueberfuehrt werden.
- `403`: keine Session
- `401`: keine Session

### `PUT /api/family/member-links`

Verknuepft einen Login-Account mit einem Profilmitglied der aktiven Familie.

Request:

```json
{
  "accountUserId": "user-2",
  "memberId": "anna"
}
```

Antwort:

- aktualisierte `FamilySummary`

Wichtige Fachregel:

- Das Backend validiert `memberId` gegen das aktuell gespeicherte Profil.
- Das Frontend speichert deshalb seit 2026-04-22 offene Profil-Aenderungen automatisch, bevor eine
  Zuordnung an `PUT /api/family/member-links` geschickt wird.

### `POST /api/family/invites/accept`

Nimmt eine gueltige Familien-Einladung an und fuehrt das persoenliche Profil des eingeloggten
Kontos in das Ziel-Familienkonto ueber.

Request:

```json
{
  "token": "invite-token"
}
```

Antwort:

- `200 OK` mit aktualisierter `FamilySummary`

Fehler:

- `403`: Einladung ungueltig oder abgelaufen
- `409`: Das eingeloggte Konto gehoert bereits zum Ziel-Familienkonto oder bereits zu einem
  anderen aktiven Familienkonto. Der Merge ist nur aus einem persoenlichen Einzelkonto erlaubt.
- `401`: keine Session
