-- Cache for GitHub reads made by Demeter (the /open-source build assistant):
-- file contents, directory listings, code-search hits, and the repo file tree.
-- lib/github.ts has referenced this table since it was written, but the
-- migration was never added — so every cache read and write failed silently,
-- every tool call went to GitHub live, and code search (~10 requests/minute)
-- rate-limited mid-conversation. A rate-limited search returns no files, which
-- is precisely when the assistant is most tempted to invent them.
--
-- Entries are keyed by an opaque cache_key built in lib/github.ts and expire
-- after an hour, enforced in application code against fetched_at. Only
-- successful responses are ever written: a failure must not be remembered as
-- "no results" for the next hour.
CREATE TABLE IF NOT EXISTS repo_cache (
  cache_key TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supports sweeping expired rows without scanning the whole table.
CREATE INDEX IF NOT EXISTS repo_cache_fetched_at_idx ON repo_cache (fetched_at);
