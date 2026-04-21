DROP INDEX IF EXISTS prompt_debug_entries_family_created_idx;
DROP TABLE IF EXISTS prompt_debug_entries;

DROP INDEX IF EXISTS family_invites_email_hash_idx;
DROP INDEX IF EXISTS family_invites_family_created_idx;
DROP TABLE IF EXISTS family_invites;

DROP INDEX IF EXISTS favorite_recipes_family_created_idx;
DROP TABLE IF EXISTS favorite_recipes;

DROP INDEX IF EXISTS users_email_hash_idx;
DROP INDEX IF EXISTS users_active_family_id_idx;
DROP INDEX IF EXISTS plans_family_week_start_desc_idx;
DROP INDEX IF EXISTS plans_family_week_start_idx;
DROP INDEX IF EXISTS profiles_family_id_idx;

ALTER TABLE plans DROP COLUMN IF EXISTS family_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS family_id;

DROP TABLE IF EXISTS family_members;

ALTER TABLE users DROP COLUMN IF EXISTS active_family_id;
ALTER TABLE users DROP COLUMN IF EXISTS email_hash;

DROP TABLE IF EXISTS families;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plans_user_week_start_idx ON plans(user_id, week_start) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS plans_user_week_start_desc_idx ON plans(user_id, week_start DESC) WHERE user_id IS NOT NULL;
