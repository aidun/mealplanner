CREATE TABLE IF NOT EXISTS users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	provider TEXT NOT NULL,
	subject_hash TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (provider, subject_hash)
);

CREATE TABLE IF NOT EXISTS sessions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	csrf_token TEXT NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS plans_week_start_idx;
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_week_start_key;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plans_user_week_start_idx ON plans(user_id, week_start) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS plans_user_week_start_desc_idx ON plans(user_id, week_start DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
