CREATE TABLE IF NOT EXISTS families (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name TEXT NOT NULL DEFAULT 'Familie',
	owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
	status TEXT NOT NULL DEFAULT 'active',
	merged_into_family_id UUID REFERENCES families(id) ON DELETE SET NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_family_id UUID REFERENCES families(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS family_members (
	family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	role TEXT NOT NULL DEFAULT 'member',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (family_id, user_id)
);

INSERT INTO families (name, owner_user_id)
SELECT 'Persoenliche Familie', u.id
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM families f WHERE f.owner_user_id = u.id);

UPDATE users u
SET active_family_id = f.id
FROM families f
WHERE f.owner_user_id = u.id AND u.active_family_id IS NULL;

INSERT INTO family_members (family_id, user_id, role)
SELECT u.active_family_id, u.id, 'owner'
FROM users u
WHERE u.active_family_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id) ON DELETE CASCADE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id) ON DELETE CASCADE;

UPDATE profiles p
SET family_id = u.active_family_id
FROM users u
WHERE p.user_id = u.id AND p.family_id IS NULL;

UPDATE plans p
SET family_id = u.active_family_id
FROM users u
WHERE p.user_id = u.id AND p.family_id IS NULL;

DROP INDEX IF EXISTS profiles_user_id_idx;
DROP INDEX IF EXISTS plans_user_week_start_idx;
DROP INDEX IF EXISTS plans_user_week_start_desc_idx;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_family_id_idx ON profiles(family_id) WHERE family_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plans_family_week_start_idx ON plans(family_id, week_start) WHERE family_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS plans_family_week_start_desc_idx ON plans(family_id, week_start DESC) WHERE family_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_active_family_id_idx ON users(active_family_id);
CREATE INDEX IF NOT EXISTS users_email_hash_idx ON users(email_hash) WHERE email_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS favorite_recipes (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
	meal_hash TEXT NOT NULL,
	data JSONB NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (family_id, meal_hash)
);

CREATE INDEX IF NOT EXISTS favorite_recipes_family_created_idx ON favorite_recipes(family_id, created_at DESC);

CREATE TABLE IF NOT EXISTS family_invites (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
	invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	email_hash TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	accepted_at TIMESTAMPTZ,
	accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS family_invites_family_created_idx ON family_invites(family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS family_invites_email_hash_idx ON family_invites(email_hash);

CREATE TABLE IF NOT EXISTS prompt_debug_entries (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
	operation TEXT NOT NULL,
	model TEXT NOT NULL DEFAULT '',
	prompt TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prompt_debug_entries_family_created_idx ON prompt_debug_entries(family_id, created_at DESC);
