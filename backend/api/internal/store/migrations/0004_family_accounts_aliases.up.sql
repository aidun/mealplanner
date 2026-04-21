ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE family_members ADD COLUMN IF NOT EXISTS linked_member_id TEXT;

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS family_members_linked_member_idx
ON family_members(family_id, linked_member_id)
WHERE linked_member_id IS NOT NULL;
