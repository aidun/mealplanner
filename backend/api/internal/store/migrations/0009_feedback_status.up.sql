ALTER TABLE feedback_entries
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE feedback_entries
SET status = 'open'
WHERE status IS NULL OR btrim(status) = '';

CREATE INDEX IF NOT EXISTS feedback_entries_status_created_idx
  ON feedback_entries(status, created_at DESC);
