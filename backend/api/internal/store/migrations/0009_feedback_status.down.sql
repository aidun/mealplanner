DROP INDEX IF EXISTS feedback_entries_status_created_idx;

ALTER TABLE feedback_entries
  DROP COLUMN IF EXISTS resolved_by_user_id,
  DROP COLUMN IF EXISTS resolved_at,
  DROP COLUMN IF EXISTS status;
