-- Social 54 — the judge.
--
-- The console's centre of gravity, replacing the metric collection it grew out
-- of. Two tables: the rubric, and what it has graded.
--
-- WHY A RUBRIC AND NOT JUST A PROMPT. An LLM asked "is this a good caption"
-- answers differently every time and none of the answers are checkable. The
-- same model asked "does the first line carry a specific fact — quote it"
-- gives an answer you can disagree with, and disagree with the same way twice.
-- The rubric is the source of truth; runs are graded against it. That is the
-- arrangement supabase/migrations/010_probatio_parsley.sql set up for agent
-- conversations, applied here to posts.
--
-- WHY NO METRICS IN EITHER TABLE. Every criterion asks about craft, which is
-- readable from a caption and a screenshot. That is what lets this work
-- without a single platform credential — and at a few hundred followers the
-- engagement numbers could not have told us much anyway; lib/social/scale.ts
-- exists to say so. What a post DOES is the part we can change.

CREATE TABLE IF NOT EXISTS social_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL means the criterion applies to every platform. Most do: "does the
  -- opening line earn the scroll-stop" is not an Instagram question, and
  -- scoping every row per platform would mean five copies of one idea, free
  -- to drift apart.
  platform TEXT,
  prompt TEXT NOT NULL,
  guidance TEXT NOT NULL DEFAULT '',
  -- Which outcome is the good one. A few criteria are written so that doing
  -- the thing is the failure ("does it use engagement bait?"); storing the
  -- polarity keeps a judge from scoring those backwards.
  expected_verdict TEXT NOT NULL DEFAULT 'pass',
  -- 1-3. Not every criterion matters equally and a flat score hides that.
  weight INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_criteria_platform_idx
  ON social_criteria (platform, sort_order);

CREATE TABLE IF NOT EXISTS social_judgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  -- The post as judged: caption, comments, handle, and where it came from.
  -- Stored because a screenshot is NOT kept (see below), so without this a
  -- saved judgement would be a verdict on content nobody can see any more.
  post JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Per-criterion verdicts with their quoted evidence.
  scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Weighted 0-100. Nullable: a post that gave no way to judge any criterion
  -- has no score, which is different from scoring zero.
  score INTEGER,
  verdict TEXT,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Present only when comments were supplied.
  sentiment JSONB,
  -- Present only when a competitor post was judged alongside ours.
  comparison JSONB,
  model TEXT,
  provider TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Screenshots are deliberately NOT stored. They are the largest thing that
-- passes through this feature and the least reusable: the model reads the
-- caption and comments out of the image and writes them into `post`, which is
-- the part a person re-reading a judgement actually needs. Keeping the images
-- would mean a storage bucket, a retention policy, and a pile of other
-- people's posts sitting in our infrastructure, to save re-uploading a file
-- that is still on the machine it came from.

CREATE INDEX IF NOT EXISTS social_judgements_created_idx
  ON social_judgements (created_at DESC);
CREATE INDEX IF NOT EXISTS social_judgements_platform_idx
  ON social_judgements (platform, created_at DESC);

-- Reached only through the service-role client in lib/social/judge/store.ts.
-- RLS on with no policy means a leaked anon key reads nothing here.
ALTER TABLE social_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_judgements ENABLE ROW LEVEL SECURITY;
