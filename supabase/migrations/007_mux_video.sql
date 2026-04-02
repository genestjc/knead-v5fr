-- Add Mux video columns to chat_events for pre-recorded event support
ALTER TABLE chat_events
  ADD COLUMN IF NOT EXISTS mux_asset_id TEXT,
  ADD COLUMN IF NOT EXISTS mux_playback_id TEXT;
