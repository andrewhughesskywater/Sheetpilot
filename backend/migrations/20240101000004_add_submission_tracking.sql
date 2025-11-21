-- Add submission tracking column to timesheet table
-- This tracks when a submission starts to enable crash recovery

ALTER TABLE timesheet ADD COLUMN submission_started_at TEXT;

