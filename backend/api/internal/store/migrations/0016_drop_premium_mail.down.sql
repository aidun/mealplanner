CREATE TABLE IF NOT EXISTS premium_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  email_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_templates (
  kind TEXT PRIMARY KEY,
  subject_template TEXT NOT NULL,
  text_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS weekly_plan_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS recipe_email_enabled BOOLEAN NOT NULL DEFAULT TRUE;
