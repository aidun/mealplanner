DROP INDEX IF EXISTS family_members_linked_member_idx;
DROP INDEX IF EXISTS users_email_idx;

ALTER TABLE family_members DROP COLUMN IF EXISTS linked_member_id;
ALTER TABLE users DROP COLUMN IF EXISTS email;
