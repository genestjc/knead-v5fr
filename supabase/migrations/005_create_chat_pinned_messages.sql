-- Create chat_pinned_messages table
CREATE TABLE IF NOT EXISTS chat_pinned_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  message_content TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  sender_name TEXT,
  pinned_by TEXT NOT NULL,
  pinned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint: only one pinned message per channel
CREATE UNIQUE INDEX IF NOT EXISTS chat_pinned_messages_channel_id_unique ON chat_pinned_messages(channel_id);

-- Enable RLS
ALTER TABLE chat_pinned_messages ENABLE ROW LEVEL SECURITY;

-- Allow public read access (viewing pinned messages)
CREATE POLICY "Allow public read access to pinned messages"
  ON chat_pinned_messages
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert/update/delete (API will verify admin status)
CREATE POLICY "Allow authenticated users to manage pinned messages"
  ON chat_pinned_messages
  FOR ALL
  USING (auth.role() = 'authenticated');
