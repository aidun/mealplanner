-- Restore premium_users, mail_templates, and generation_events tables
-- Restore email preference columns to user_settings

CREATE TABLE IF NOT EXISTS premium_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  email_hash TEXT NOT NULL UNIQUE,
  granted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS premium_users_created_idx ON premium_users(created_at DESC);

CREATE TABLE IF NOT EXISTS mail_templates (
  kind TEXT PRIMARY KEY,
  subject_template TEXT NOT NULL,
  text_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generation_events_category_created_idx ON generation_events(category, created_at DESC);
CREATE INDEX IF NOT EXISTS generation_events_family_created_idx ON generation_events(family_id, created_at DESC);

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS weekly_plan_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS recipe_email_enabled BOOLEAN NOT NULL DEFAULT TRUE;
