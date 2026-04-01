-- Add event_pass_only flag to chat_events
-- When true, only users with an active Event Pass NFT can send messages during this event.
-- Contributors and Knead Monthly holders are temporarily excluded.
ALTER TABLE chat_events
  ADD COLUMN IF NOT EXISTS event_pass_only BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chat_events_pass_only ON chat_events(event_pass_only)
  WHERE event_pass_only = true;
