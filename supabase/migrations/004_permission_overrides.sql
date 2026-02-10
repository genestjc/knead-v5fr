-- Create permission_overrides table for global permission controls
-- This table allows admins to override default permission behavior

CREATE TABLE IF NOT EXISTS permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('freemium', 'participant', 'contributor')),
  permission_type TEXT NOT NULL CHECK (permission_type IN ('canMessage', 'canReact', 'canDM')),
  is_enabled BOOLEAN DEFAULT false,
  updated_by TEXT, -- admin wallet address
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create unique constraint to prevent duplicate role/permission combinations
CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_overrides_unique 
  ON permission_overrides(role, permission_type);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_permission_overrides_role 
  ON permission_overrides(role);

-- Create temporary_permissions table for event-specific access grants
-- This allows admins to grant temporary access to specific wallet addresses

CREATE TABLE IF NOT EXISTS temporary_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('canMessage', 'canReact', 'canDM')),
  expires_at TIMESTAMP NOT NULL,
  created_by TEXT, -- admin wallet address
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_temp_perms_wallet_channel 
  ON temporary_permissions(wallet_address, channel_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_temp_perms_expires 
  ON temporary_permissions(expires_at);

-- Auto-update updated_at column for permission_overrides
CREATE OR REPLACE FUNCTION update_permission_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_permission_overrides_updated_at_trigger ON permission_overrides;
CREATE TRIGGER update_permission_overrides_updated_at_trigger
  BEFORE UPDATE ON permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_permission_overrides_updated_at();

-- Function to clean up expired temporary permissions
CREATE OR REPLACE FUNCTION cleanup_expired_temporary_permissions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM temporary_permissions
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert default permission overrides (all disabled by default)
INSERT INTO permission_overrides (role, permission_type, is_enabled)
VALUES 
  ('freemium', 'canMessage', false),
  ('freemium', 'canReact', false),
  ('participant', 'canMessage', false),
  ('participant', 'canReact', true),
  ('contributor', 'canDM', true)
ON CONFLICT (role, permission_type) DO NOTHING;

COMMENT ON TABLE permission_overrides IS 'Global permission overrides controlled by admins. When enabled, these override default NFT-based permissions.';
COMMENT ON TABLE temporary_permissions IS 'Temporary permissions granted to specific wallet addresses for special events. Automatically expire.';
COMMENT ON FUNCTION cleanup_expired_temporary_permissions() IS 'Removes expired temporary permissions. Should be called periodically.';
