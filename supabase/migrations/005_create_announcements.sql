-- Create announcements table
CREATE TABLE IF NOT EXISTS chat_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  contributors_only BOOLEAN DEFAULT FALSE,
  posted_by TEXT NOT NULL,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_announcements_posted_at ON chat_announcements(posted_at DESC);
CREATE INDEX idx_announcements_contributors_only ON chat_announcements(contributors_only);

-- RLS
ALTER TABLE chat_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to announcements"
  ON chat_announcements
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage announcements"
  ON chat_announcements
  FOR ALL
  USING (auth.role() = 'authenticated');
