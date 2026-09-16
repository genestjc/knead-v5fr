-- Drop the Social 54 tables.
--
-- /social54 has been replaced by the Social Audit tab inside Probatio Parsley.
-- The new surface stores nothing of its own beyond eval_social_media (the Mux
-- IDs for uploaded recordings): criteria live in eval_criteria, runs in
-- eval_runs, verdicts in eval_results, which is the point of having folded it
-- into Probatio rather than standing up a parallel console.
--
-- WHAT IS BEING LOST, stated plainly rather than discovered later:
--
--   social_posts and social_editorial_items held COLLECTED DATA — engagement
--   counts pulled from the platform APIs, and competitor headlines pulled from
--   RSS. Nothing reads them any more, and nothing will: the audit reads posts
--   out of screenshots and recordings, and it compares on craft rather than on
--   reach, because our accounts are in the hundreds and a competitor's may be
--   in the tens of thousands.
--
--   social_criteria and social_judgements held the old social rubric and its
--   verdicts. The rubric is not lost — its rows were rewritten into
--   lib/eval/rubric-seed.ts under the social-audit surface, with weights and
--   platform scoping intact, and they seed into eval_criteria on first load.
--   Past judgements are lost. They were graded against posts that were never
--   stored, so there is nothing to re-read them against.
--
-- RUN 016 FIRST if you have not. It creates eval_social_media and widens the
-- eval_criteria surface constraint, and running this one first would leave you
-- with neither console.
--
-- IF YOU WANT THE COLLECTED DATA, export it before running this:
--   \copy (SELECT * FROM social_posts) TO 'social_posts.csv' CSV HEADER
--   \copy (SELECT * FROM social_editorial_items) TO 'editorial.csv' CSV HEADER
--
-- Dropped children-first, though CASCADE would handle it either way.

DROP TABLE IF EXISTS social_judgements CASCADE;
DROP TABLE IF EXISTS social_criteria CASCADE;
DROP TABLE IF EXISTS social_editorial_items CASCADE;
DROP TABLE IF EXISTS social_runs CASCADE;
DROP TABLE IF EXISTS social_posts CASCADE;
DROP TABLE IF EXISTS social_competitors CASCADE;
