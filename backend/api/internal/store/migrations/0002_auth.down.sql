DROP INDEX IF EXISTS sessions_expires_at_idx;
DROP INDEX IF EXISTS plans_user_week_start_desc_idx;
DROP INDEX IF EXISTS plans_user_week_start_idx;
DROP INDEX IF EXISTS profiles_user_id_idx;

ALTER TABLE plans DROP COLUMN IF EXISTS user_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS user_id;

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

CREATE UNIQUE INDEX IF NOT EXISTS plans_week_start_key ON plans(week_start);
CREATE INDEX IF NOT EXISTS plans_week_start_idx ON plans(week_start DESC);
