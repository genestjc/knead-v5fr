-- Social 54 — the /social54 monitoring console.
--
-- Three tables, each for a different reason:
--
--  * social_competitors — the roster we measure against. Editable in the
--    console, seeded from lib/social/config.ts on first load.
--
--  * social_posts — a rolling archive of every post the collector has ever
--    seen, ours and theirs. This is the table that makes MACRO trends
--    possible at all. Every platform API has a short window (X's standard
--    tier reaches back seven days), so without an archive the console could
--    only ever answer "what happened this week" and would re-answer it from
--    scratch every week. Keeping the rows means a question like "has their
--    cadence risen since spring" has somewhere to be answered from.
--
--    The primary key is (platform, post_id), so re-collecting a post updates
--    its metrics in place rather than duplicating it — engagement keeps
--    accruing after publication, and the newest read is the right one. Its
--    first_seen_at is preserved by the upsert in lib/social/store.ts.
--
--  * social_runs — saved analyses (sentiment, trends, head-to-head, composer
--    drafts). Stored so a finding can be reopened and compared against the
--    next one, which is the only way a trend claim can be checked.

CREATE TABLE IF NOT EXISTS social_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  note TEXT,
  -- [{ "platform": "instagram", "handle": "hyperallergic" }, ...]
  handles JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per publication. Re-seeding is guarded on this in application code,
-- so a competitor an admin renamed is never re-created under the old name.
CREATE UNIQUE INDEX IF NOT EXISTS social_competitors_name_idx
  ON social_competitors (lower(name));

CREATE TABLE IF NOT EXISTS social_posts (
  platform TEXT NOT NULL,
  post_id TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  author_handle TEXT NOT NULL,
  author_name TEXT,
  is_ours BOOLEAN NOT NULL DEFAULT FALSE,
  body TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT 'unknown',
  published_at TIMESTAMPTZ NOT NULL,
  -- Normalized SocialMetrics. A metric the platform does not report is stored
  -- as null, never 0 — see lib/social/types.ts.
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  author_followers INTEGER,
  tags TEXT[] NOT NULL DEFAULT '{}',
  links TEXT[] NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (platform, post_id)
);

-- The two access patterns: "this account over this window" (every summary and
-- trend read) and "everything recent across the field" (the pulse table).
CREATE INDEX IF NOT EXISTS social_posts_account_time_idx
  ON social_posts (platform, author_handle, published_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_published_idx
  ON social_posts (published_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_ours_idx
  ON social_posts (is_ours, published_at DESC);

CREATE TABLE IF NOT EXISTS social_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  provider TEXT,
  model TEXT,
  summary TEXT,
  -- The structured result. Shape depends on kind; the console reads it through
  -- the types in lib/social/types.ts.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS social_runs_kind_time_idx
  ON social_runs (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS social_runs_created_idx
  ON social_runs (created_at DESC);

-- These tables are reached only through the service-role client in
-- lib/social/store.ts, which bypasses RLS. Enabling RLS with no policy means a
-- leaked anon key reads nothing here, rather than reading everything.
ALTER TABLE social_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_runs ENABLE ROW LEVEL SECURITY;
