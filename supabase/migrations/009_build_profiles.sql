-- Demeter (the /open-source build assistant) remembers returning visitors so
-- it can welcome them back, offer to pick up their last project, and calibrate
-- explanations to their comfort level. One row per identifier — the wallet
-- address when signed in, the IP otherwise (the same identifiers build_usage
-- already uses for rate limiting). Demeter writes to this table itself via
-- the update_builder_profile tool.
CREATE TABLE IF NOT EXISTS build_profiles (
  identifier TEXT PRIMARY KEY,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('wallet', 'ip')),
  first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  visit_count INTEGER NOT NULL DEFAULT 1,
  last_project TEXT,
  skill_level TEXT CHECK (skill_level IN ('brand-new', 'some-experience', 'comfortable')),
  notes TEXT
);
