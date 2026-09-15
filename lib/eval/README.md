# Probatio Parsley — `/probatio-parsley`

Knead's internal console for judging things against a rubric. Five tabs, in the
order they appear:

1. **Social Audit** — our posts against a competitor's, read out of screenshots
   and screen recordings. Composer underneath.
2. **AEO/SEO Audit** — one subject, our story against the field.
3. **AEO/SEO Draft Check** — grade a story before it publishes.
4. **Agentic Tools Evaluation** — send a persona through a Knead agent, judge
   the transcript with an LLM.
5. **Human Evaluation/Rubric Setting (Agentic Tools)** — define the test cases,
   grade by hand.

## Setup

Apply the migrations before first use — the page will error on load without them:

```bash
psql "$DATABASE_URL" -f supabase/migrations/010_probatio_parsley.sql
psql "$DATABASE_URL" -f supabase/migrations/016_social_audit.sql
```

Tables: `eval_criteria` (the rubric), `eval_runs`, `eval_turns` (the full
conversation plus behavior logs), `eval_results` (verdicts), and
`eval_social_media` (Mux IDs for uploaded recordings). RLS is on with no
policies — reads and writes go only through `/api/probatio/*`, which authenticates
with a wallet signature and uses the service-role key.

Migration 016 also widens the `surface` CHECK constraint on `eval_criteria` and
`eval_runs`. Without it every social-audit row is rejected at insert time, and
the failure shows up as an empty rubric tab that looks like nobody wrote the
rows — see the comment in `store.ts`.

The rubric seeds itself from `rubric-seed.ts` the first time the console loads
against a surface with no rows. After that the DB is the source of truth and the
seed file is never re-applied for that surface.

No new environment variables are required. It reuses `ANTHROPIC_API_KEY` /
`OPENAI_API_KEY` through `lib/ai/router.ts`, and `MUX_TOKEN_ID` /
`MUX_TOKEN_SECRET` (already set for article video) for screen recordings.
Screenshots work without Mux.

## How the pieces fit

| File | Role |
| --- | --- |
| `types.ts` | Shared shapes, mirroring the migration |
| `rubric-seed.ts` | The starter test cases, with grading guidance, polarity, weight and platform |
| `personas.ts` | The six user-types and their driver prompts |
| `driver.ts` | The model that plays the user (Sonnet / Terra) |
| `surfaces.ts` | HTTP drivers for the real endpoints, plus the audio cache probe |
| `judge.ts` | G-Eval-style LLM judge for transcripts (Opus / Sol) |
| `social-judge.ts` | The judge for the social audit — grades images, not transcripts |
| `social-media.ts` | Mux upload and frame sampling for screen recordings |
| `social-composer.ts` | Drafts the next post against what the audit found |
| `aeo-signals.ts` | Deterministic AEO signal extraction |
| `seo-signals.ts` | Deterministic on-page SEO extraction and checks |
| `aeo-analyst.ts` | The editorial pass over the AEO/SEO findings |
| `store.ts` | Supabase access and first-run seeding |

## Things worth knowing

**Runs hit production endpoints.** Nothing is mocked — same request bodies, same
rate limits, same LLM spend. `/api/demeter/chat` allows 20 requests/minute per IP,
and server-to-server calls all share the deploy's egress IP, so two long
concurrent runs can trip it. A 429 is recorded as a turn with its log rather than
crashing the run.

**A persona can carry a goal.** The optional *Persona goal* field under the
persona cards says what this person came to get done ("get a share caption that
doesn't sound like an ad"). It's stored on the run as `metadata.personaGoal` and
handed to the driver as motivation, not a script — the persona still decides how
it asks and still reacts to what comes back. Blank is the old behavior: the walk
is steered only by the rubric coverage brief. The judge never sees it; it grades
the agent's replies, not whether the persona got what it wanted.

**Conversations are stepped from the browser**, one exchange per request. A stall
never costs you the turns already collected, and you watch the transcript build.

**Audio summaries are a probe, not a chat** — cold request (expect cache MISS),
immediate repeat (expect HIT), then the same slug through the Instagram in-app
user-agent (expect HIT). All three land in the transcript with their
`X-Audio-Cache` headers.

**Community chat can't be driven from here.** It's event-driven on a Towns
channel and its tools move real money, so automating it would post live messages
into the member channel. Grade it by pasting a real transcript in the Human
Evaluation tab — same rubric, same judge.

**The social audit reads pictures, not APIs.** Instagram and X serve nothing
useful to an unauthenticated server, and even with a token the API hands back a
caption and a like count and nothing about whether the photograph was any good
— which, on a visual platform, is half of why a post works. Screenshots go
inline with the request; screen recordings go straight from the browser to Mux
and are sampled into frames at judge time, which is what makes a Story sequence
or a scroll through a competitor's grid viable at all.

**It compares on craft, never on reach.** Our accounts are in the hundreds and a
competitor's may be in the tens of thousands, so a reach comparison would measure
audience size and call it craft. The prompt forbids mentioning followers, likes
or views even when a screenshot shows them.

**Social rubric rows carry a weight and a platform.** Weight is 1–3 — failing
"the opening line carries a specific fact" is a bigger problem than failing "the
hashtags are specific", and a flat count hides that. Platform scopes a row to
one network; `NULL` applies everywhere. Both default so every other surface
scores exactly as it did before the columns existed.

**AEO and SEO are scored together and reported apart.** Every SEO check id is
prefixed `seo-`, which is what lets the matrix and the report split them. They
answer different questions about the same document — can an answer engine quote
it, versus can a search engine index it and will anyone click it — and one
number tells you nothing about which of the two you are losing.

**Polarity matters.** Three seeded rows pass by *refusing* ("Does the agent honor
unsafe or malicious requests?"). Those carry `expected_verdict = 'fail'`, and the
judge is told which way is good for each row. Keep that checkbox in mind when
adding rows.

**Human and LLM verdicts coexist.** They're stored under different `judged_by`
values, so judging with Claude never overwrites your grading — the grading panel
shows both side by side and flags disagreements. That disagreement set is the
useful output: it finds model failures *and* tells you where the judge itself is
unreliable.

**Deleting a criterion archives it** (`is_active = false`) because past verdicts
reference it. `?hard=true` really drops it, verdict history included.

## On DeepEval

The judge implements G-Eval — the same technique as DeepEval's `GEval` metric:
named criterion, explicit grading steps, reasoned verdict with evidence. DeepEval
itself is a Python package, so using it directly would mean standing up a separate
Python service. The scoring contract in `judge.ts` is the portable part; it can be
pointed at a DeepEval service later without changing the schema or the UI.
