-- Create freemium_chat_sessions table
-- This table tracks chat viewing time for freemium users (Token ID 0 only)
-- to enforce the 1 hour/month viewing limit

CREATE TABLE IF NOT EXISTS freemium_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  session_start TIMESTAMP NOT NULL DEFAULT NOW(),
  session_end TIMESTAMP,
  duration_seconds INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_freemium_chat_wallet ON freemium_chat_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_freemium_chat_month ON freemium_chat_sessions(created_at);

-- Function to get remaining time this month for a freemium user
-- Returns remaining seconds out of 3600 (1 hour)
CREATE OR REPLACE FUNCTION get_freemium_chat_time_remaining(p_wallet_address TEXT)
RETURNS INT AS $$
DECLARE
  total_seconds INT;
  month_start TIMESTAMP;
BEGIN
  -- Get start of current month
  month_start := date_trunc('month', CURRENT_TIMESTAMP);
  
  -- Sum all session durations this month for this wallet
  SELECT COALESCE(SUM(duration_seconds), 0)
  INTO total_seconds
  FROM freemium_chat_sessions
  WHERE wallet_address = LOWER(p_wallet_address)
    AND created_at >= month_start;
  
  -- Return remaining time (max 3600 seconds = 1 hour)
  RETURN GREATEST(0, 3600 - total_seconds);
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining table purpose
COMMENT ON TABLE freemium_chat_sessions IS 'Tracks chat viewing time for freemium users to enforce 1 hour/month limit';
COMMENT ON FUNCTION get_freemium_chat_time_remaining IS 'Returns remaining chat time in seconds for a freemium user this month (max 3600)';
