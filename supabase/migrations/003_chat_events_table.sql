-- Create chat_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  channel_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('live', 'discussion', 'essay')),
  host_id TEXT NOT NULL,  -- User ID of interviewer/admin
  guest_ids TEXT[] DEFAULT '{}',  -- Array of guest user IDs
  scheduled_start TIMESTAMP NOT NULL,
  scheduled_end TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  daily_room_name TEXT,  -- e.g., "knead-123456-abc"
  daily_room_url TEXT,   -- e.g., "https://knead.daily.co/knead-123456-abc"
  video_enabled BOOLEAN DEFAULT true,
  recording_url TEXT,    -- Daily's cloud recording URL (if recorded)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_events_status ON chat_events(status);
CREATE INDEX IF NOT EXISTS idx_chat_events_scheduled ON chat_events(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_chat_events_host ON chat_events(host_id);

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION update_chat_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chat_events_updated_at_trigger ON chat_events;
CREATE TRIGGER update_chat_events_updated_at_trigger
  BEFORE UPDATE ON chat_events
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_events_updated_at();
