-- Demeter (the /open-source build assistant) remembers returning signed-in
-- visitors so it can welcome them back, offer to pick up their last project,
-- and calibrate explanations to their comfort level. Keyed by wallet address
-- ONLY — IPs are shared between people (offices, cafés, families), so
-- anonymous visitors get no memory and are treated as beginners by default.
-- Demeter writes to this table itself via the update_builder_profile tool.
CREATE TABLE IF NOT EXISTS build_profiles (
  wallet_address TEXT PRIMARY KEY,
  first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  visit_count INTEGER NOT NULL DEFAULT 1,
  last_project TEXT,
  skill_level TEXT CHECK (skill_level IN ('brand-new', 'some-experience', 'comfortable')),
  notes TEXT
);
