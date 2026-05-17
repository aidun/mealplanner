-- Drop premium_users, mail_templates, and generation_events tables
-- Remove email preference columns from user_settings

DROP TABLE IF EXISTS premium_users;
DROP TABLE IF EXISTS mail_templates;
DROP TABLE IF EXISTS generation_events;

ALTER TABLE user_settings
  DROP COLUMN IF EXISTS weekly_plan_email_enabled,
  DROP COLUMN IF EXISTS recipe_email_enabled;
