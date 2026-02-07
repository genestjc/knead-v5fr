-- Drop old chat tables that are replaced by Towns Protocol
-- These tables are no longer needed as all chat functionality moves to Towns Protocol

-- Drop tables in correct order (respecting foreign key constraints)
DROP TABLE IF EXISTS message_likes CASCADE;
DROP TABLE IF EXISTS typing_indicators CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_users CASCADE;

-- KEEP these tables (they are still in use):
-- ✅ article_reads (article paywall)
-- ✅ mint_attempts (article paywall)
-- ✅ subscriptions (article paywall)
-- ✅ users (article paywall)
-- ✅ freemium_chat_sessions (NEW - freemium timer)
-- ✅ moderation_logs (if exists - compliance)
-- ✅ chat_events (if exists - custom events)
-- ✅ towns_claim_requests (if exists - admin dashboard)

-- Add comments
COMMENT ON DATABASE postgres IS 'Supabase database - chat tables removed, migrated to Towns Protocol on-chain storage';
