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
