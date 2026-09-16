-- Probatio Parsley — the Social Audit surface.
--
-- Social Audit is a Probatio surface like any other: criteria live in
-- eval_criteria, runs in eval_runs, verdicts in eval_results. Nothing about
-- the judging machinery is duplicated for it, which is the point — one rubric
-- table, one grader, one place a definition of "good" can live.
--
-- Two columns are added to support it.
--
-- WEIGHT. Every other surface asks questions of roughly equal importance, so a
-- flat count was fine. Social posts are not like that: a post that fails "the
-- opening line carries a specific fact" has a bigger problem than one that
-- fails "the hashtags are specific", and scoring those the same hides it. The
-- column defaults to 1, so every existing row keeps behaving exactly as it did.
--
-- PLATFORM. A criterion may be scoped to one platform — "does the first line
-- survive the timeline truncating" is an X question and meaningless about a
-- LinkedIn post. NULL means it applies everywhere, which is what most of them
-- do and what every pre-existing row is.
--
-- Nothing here is social-specific in the schema; both columns are general, and
-- another surface can use them if it ever needs to.

-- FIRST, the constraint that would otherwise reject every social-audit row.
--
-- `surface` is CHECK-constrained to the list of surfaces that existed when the
-- table was created, on both eval_criteria and eval_runs. A surface added
-- afterwards is rejected at insert time, and the failure surfaces as an empty
-- rubric tab that looks like nobody wrote the rows — lib/eval/store.ts carries
-- a long comment about exactly this, because it has happened before.
--
-- The constraint is found by shape rather than by name: it was created inline
-- with the column, so Postgres named it itself and the name is not guaranteed
-- to be the same in every environment. Dropping by discovery and re-adding is
-- the version that works whatever it ended up called.
DO $$
DECLARE
  target TEXT;
  con    RECORD;
BEGIN
  FOREACH target IN ARRAY ARRAY['eval_criteria', 'eval_runs'] LOOP
    IF to_regclass(target) IS NULL THEN CONTINUE; END IF;

    FOR con IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = target::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%surface%'
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', target, con.conname);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (surface IN (%L, %L, %L, %L, %L, %L, %L))',
      target,
      target || '_surface_check',
      'article-agent', 'audio-summaries', 'open-source', 'community-chat',
      'aeo-audit', 'aeo-story', 'social-audit'
    );
  END LOOP;
END $$;

ALTER TABLE eval_criteria
  ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 1;

ALTER TABLE eval_criteria
  ADD COLUMN IF NOT EXISTS platform TEXT;

COMMENT ON COLUMN eval_criteria.weight IS
  '1-3. How much this criterion moves the score. Defaults to 1 so existing surfaces are unaffected.';
COMMENT ON COLUMN eval_criteria.platform IS
  'Scopes a criterion to one social platform. NULL applies everywhere. Used by the social-audit surface.';

-- Video uploaded for a social audit, so a run can be reopened without
-- re-uploading and re-transcoding.
--
-- Only the Mux IDs are kept, never the file: Mux already stores the recording,
-- and the frames the judge actually reads are pulled from image.mux.com on
-- demand. Keeping our own copy would duplicate a large asset to save a URL.
CREATE TABLE IF NOT EXISTS eval_social_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which side of the comparison this belongs to, and which run.
  run_id UUID REFERENCES eval_runs(id) ON DELETE CASCADE,
  is_ours BOOLEAN NOT NULL DEFAULT TRUE,
  label TEXT NOT NULL DEFAULT '',
  platform TEXT,
  mux_upload_id TEXT,
  mux_asset_id TEXT,
  mux_playback_id TEXT,
  -- Seconds. Needed to space frame timestamps evenly across the recording.
  duration_seconds NUMERIC,
  -- 'waiting' until Mux finishes transcoding, then 'ready' or 'errored'.
  status TEXT NOT NULL DEFAULT 'waiting',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS eval_social_media_run_idx
  ON eval_social_media (run_id);
CREATE INDEX IF NOT EXISTS eval_social_media_upload_idx
  ON eval_social_media (mux_upload_id);

ALTER TABLE eval_social_media ENABLE ROW LEVEL SECURITY;
