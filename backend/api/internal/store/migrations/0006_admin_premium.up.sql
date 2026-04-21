CREATE TABLE IF NOT EXISTS premium_users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	email TEXT NOT NULL UNIQUE,
	email_hash TEXT NOT NULL UNIQUE,
	granted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS premium_users_created_idx ON premium_users(created_at DESC);

CREATE TABLE IF NOT EXISTS generation_events (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	family_id UUID REFERENCES families(id) ON DELETE SET NULL,
	category TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generation_events_category_created_idx ON generation_events(category, created_at DESC);
CREATE INDEX IF NOT EXISTS generation_events_family_created_idx ON generation_events(family_id, created_at DESC);
