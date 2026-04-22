UPDATE mail_templates
SET
  subject_template = 'Einladung zu Mahlio von {{family_name}}',
  text_template = 'Du wurdest zu einem Mahlio-Familienkonto eingeladen.
Familienkonto: {{family_name}}

Mit dem Annehmen der Einladung wird dein persoenlicher Account in dieses Familienkonto ueberfuehrt.
{{warning_text}}

Einladung annehmen:
{{invite_link}}

Rueckfragen:
{{support_email}}',
  html_template = '<p>Du wurdest zu einem Mahlio-Familienkonto eingeladen.</p><p><strong>Familienkonto:</strong> {{family_name}}</p><p>Mit dem Annehmen der Einladung wird dein persoenlicher Account in dieses Familienkonto ueberfuehrt.</p><p>{{warning_text}}</p><p><a href="{{invite_link}}">Einladung annehmen</a></p><p>Rueckfragen: {{support_email}}</p>',
  updated_at = now()
WHERE kind = 'family_invite'
  AND subject_template = 'Komm zu {{family_name}} auf Mahlio'
  AND text_template = 'Du bist zu Mahlio eingeladen.
Haushalt: {{family_name}}

Mit dem Annehmen der Einladung kommt dein Login in diesen gemeinsamen Bereich. Woche, Rezepte und Einkauf liegen dort an einem Ort.
{{warning_text}}

Einladung annehmen:
{{invite_link}}

Rueckfragen:
{{support_email}}';

UPDATE mail_templates
SET
  subject_template = 'Mahlio Premium ist für dich freigeschaltet',
  text_template = 'Hallo,

Mahlio Premium ist gerade für dich freigeschaltet.
Der inoffizielle Deal: Premium kostet aktuell nichts, dafuer freuen wir uns ueber ehrliches Feedback.
Unten rechts in der App findest du den Feedback-Button.

Zur App:
{{app_url}}

Rueckfragen:
{{support_email}}',
  html_template = '<p>Hallo,</p><p>Mahlio Premium ist gerade fuer dich freigeschaltet.</p><p>Der inoffizielle Deal: Premium kostet aktuell nichts, dafuer freuen wir uns ueber ehrliches Feedback.</p><p>Unten rechts in der App findest du den Feedback-Button.</p><p><a href="{{app_url}}">Zur App</a></p><p>Rueckfragen: {{support_email}}</p>',
  updated_at = now()
WHERE kind = 'premium_invite'
  AND subject_template = 'Mahlio Premium ist für euren Haushalt aktiv'
  AND text_template = 'Hallo,

Mahlio Premium ist jetzt fuer euren Haushalt aktiv.
Damit bleiben Woche, Rezepte und Einkauf in einem durchgehenden Fluss.
Aktuell freuen wir uns im Gegenzug ueber ehrliches Feedback direkt aus der App.

Zur App:
{{app_url}}

Rueckfragen:
{{support_email}}';

UPDATE mail_templates
SET
  subject_template = 'Neuer Wochenplan ab {{week_start}}',
  text_template = 'Hallo {{family_name}},

dein neuer automatischer Mahlio-Wochenplan ab {{week_start}} ist fertig.

Plan ansehen:
{{plan_url}}

Rueckfragen:
{{support_email}}',
  html_template = '<p>Hallo {{family_name}},</p><p>dein neuer automatischer Mahlio-Wochenplan ab <strong>{{week_start}}</strong> ist fertig.</p><p><a href="{{plan_url}}">Plan ansehen</a></p><p>Rueckfragen: {{support_email}}</p>',
  updated_at = now()
WHERE kind = 'weekly_plan_ready'
  AND subject_template = 'Euer Mahlio-Wochenplan ab {{week_start}} ist da'
  AND text_template = 'Hallo {{family_name}},

euer neuer Mahlio-Wochenplan ab {{week_start}} ist bereit.
Rezepte, Woche und Einkauf sind abgestimmt und koennen direkt geprueft werden.

Plan ansehen:
{{plan_url}}

Rueckfragen:
{{support_email}}';
