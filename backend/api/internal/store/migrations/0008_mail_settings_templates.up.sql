CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weekly_plan_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  recipe_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_templates (
  kind TEXT PRIMARY KEY,
  subject_template TEXT NOT NULL,
  text_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
