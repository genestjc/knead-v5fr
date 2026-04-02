-- Event passes are tracked in Supabase rather than on-chain.
-- This allows instant revocation and zero-gas admin operations.
CREATE TABLE IF NOT EXISTS event_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'burned')),
  granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  burned_at TIMESTAMP,
  UNIQUE (event_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_event_passes_wallet ON event_passes(wallet_address, status);
CREATE INDEX IF NOT EXISTS idx_event_passes_event  ON event_passes(event_id, status);
