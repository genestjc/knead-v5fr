# Probatio Parsley — `/probatio-parsley`

Knead's internal console for evaluating Demeter (article agent), audio summaries,
the open-source build assistant, and the community chat agent.

## Setup

Apply the migration before first use — the page will error on load without it:

```bash
psql "$DATABASE_URL" -f supabase/migrations/010_probatio_parsley.sql
```

Four tables: `eval_criteria` (the rubric), `eval_runs`, `eval_turns` (the full
conversation plus behavior logs), `eval_results` (verdicts). RLS is on with no
policies — reads and writes go only through `/api/probatio/*`, which authenticates
with a wallet signature and uses the service-role key.

The rubric seeds itself from `rubric-seed.ts` the first time the console loads
against an empty table. After that the DB is the source of truth and the seed
file is never re-applied.

No new environment variables. It reuses `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
through `lib/ai/router.ts`.

## How the pieces fit

| File | Role |
| --- | --- |
| `types.ts` | Shared shapes, mirroring the migration |
| `rubric-seed.ts` | The 35 starter edge cases, with grading guidance and polarity |
| `personas.ts` | The six user-types and their driver prompts |
| `driver.ts` | The model that plays the user (Sonnet / Terra) |
| `surfaces.ts` | HTTP drivers for the real endpoints, plus the audio cache probe |
| `judge.ts` | G-Eval-style LLM judge (Opus / Sol) |
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
