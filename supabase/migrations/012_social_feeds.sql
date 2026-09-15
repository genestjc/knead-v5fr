-- Social 54 — competitor RSS/Atom feeds.
--
-- Every social API in the console is gated on the METRICS: Instagram and X
-- have no public read path, LinkedIn will not show another organization's
-- posts at any price. None of them gate the journalism. What a publication
-- printed, and when, is announced by the publication itself in a format built
-- to be read by programs.
--
-- That matters most for the case this console is actually in. Coverage and
-- cadence are the two comparisons that do NOT decay across an audience-size
-- gap: a magazine with a few hundred followers and one with several hundred
-- thousand can be compared exactly and fairly on what they chose to cover and
-- how often. Engagement cannot — see lib/social/scale.ts. So for a small
-- account the feed is frequently worth more than the social handles, and it
-- costs nothing to read.
--
-- Stored per competitor rather than derived each time because feed discovery
-- means fetching the homepage and probing a handful of conventional paths;
-- doing that on every sweep is several needless requests at somebody else's
-- server.

ALTER TABLE social_competitors
  ADD COLUMN IF NOT EXISTS feed_url TEXT;

COMMENT ON COLUMN social_competitors.feed_url IS
  'RSS/Atom feed. Discovered from the publication''s homepage when the roster entry is created; see lib/social/editorial.ts.';

-- Archive of what the field published, for the same reason social_posts exists
-- for what they posted: a coverage-gap claim is only checkable against what
-- was there last time, and no feed serves more than its most recent entries.
--
-- Keyed on the article URL, so re-sweeping updates a piece in place rather
-- than duplicating it when its title or summary is edited after publication.
CREATE TABLE IF NOT EXISTS social_editorial_items (
  url TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  host TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  categories TEXT[] NOT NULL DEFAULT '{}',
  -- Nullable on purpose: plenty of feeds omit dates, and dropping those
  -- entries would silently narrow a publication's output to whatever it
  -- happens to timestamp.
  published_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_editorial_source_time_idx
  ON social_editorial_items (source, published_at DESC);
CREATE INDEX IF NOT EXISTS social_editorial_published_idx
  ON social_editorial_items (published_at DESC);

-- Reached only through the service-role client in lib/social/store.ts. RLS on
-- with no policy means a leaked anon key reads nothing here.
ALTER TABLE social_editorial_items ENABLE ROW LEVEL SECURITY;
