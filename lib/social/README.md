# Social 54

The engine behind `/social54` — Knead's social monitoring console. Five
platforms in one place, with agents that read the replies, track what the field
is doing, and compare our posts against the competition on the subjects we are
writing about.

It is a sibling to `lib/eval` (Probatio Parsley) and borrows its shape
deliberately: deterministic work first, a model only for the part that needs
judgment, and every claim traceable to something a person can check.

## The one rule everything here is arranged around

**A number we don't have is never rendered as zero.**

Five platforms publish five different shapes of the same act. Instagram counts
saves and reports them for our account only; X counts quotes and bookmarks;
Farcaster counts recasts; Zora counts paid collects; LinkedIn won't tell us
anything about anyone else's page at all. Treating "this platform doesn't
publish it" as `0` produces a dashboard that is confidently wrong on every
screen — a competitor with no save count looks like a competitor nobody saves.

So: `SocialMetrics` fields are `number | null`, comparisons run on the
*intersection* of what both sides report (`comparableFields`), the UI renders
`null` as a dash with the reason on hover, and every agent prompt opens with a
caveats block naming what the pull could not see.

## Layout

```
lib/social/
  types.ts            normalized shapes; mirrors migration 011
  config.ts           our handles, the competitor seed, credential detection
  http.ts             the one bounded, timed-out fetch every connector makes
  collect.ts          the fan-out, with per-platform failure isolation
  metrics.ts          engagement, rate, median, movement — all pure, all tested
  field.ts            computed field statistics (cadence, format mix, tag deltas)
  subjects.ts         matching a post to the thing it is about
  stories.ts          Sanity stories, reduced to what the composer may claim
  store.ts            Supabase: roster, post archive, saved runs
  require-admin.ts    the auth gate
  demo-mode.ts        the bypass flag alone, so the client can read it
  providers/          one file per platform
  agents/             sentiment, trends, head-to-head, composer
```

## Why the archive exists

`social_posts` keeps every post the collector has ever seen. Without it the
console could only answer "what happened this week" — X's standard tier reaches
back seven days — and would re-answer it from scratch every week.

The trend agent is told how deep the archive actually is and refuses macro
claims under three weeks of history. A console that quietly upgrades a week of
data into a strategic trend is worse than one that says it doesn't know yet.

## Why the deterministic/model split is where it is

Cadence, medians, movement and format mix are **arithmetic**, computed in
`metrics.ts` and `field.ts` before any model sees the data. A model asked to
eyeball them from a post list will approximate — plausibly, wrongly, and in the
same confident tone it uses for the things it got right.

What's left for the agents is the part that genuinely needs reading: what a
competitor's post did with the same subject that ours didn't, what the replies
actually mean, what to change. Every one of them is required to quote its
evidence.

## Platform limits, stated once

| Platform | Ours | Competitors | Reply text |
|---|---|---|---|
| Instagram | full, incl. saves + reach | likes/comments/captions via `business_discovery` | ours only |
| X | full `public_metrics` | full `public_metrics` | needs a tier allowing recent search |
| Farcaster | full, public | full, public | Neynar only |
| Zora | collects, public | collects, public | none |
| LinkedIn | full | **none — API scopes reads to pages we administer** | ours only |

Farcaster is the only platform where competitor data is as complete as our own,
which is worth weighting accordingly when the numbers disagree with Instagram's.

## Auth

`SOCIAL54_DEMO_MODE` in `demo-mode.ts` defaults to `false`, unlike
Probatio's. These routes read through five social credentials, spend model
budget on every analysis, and return unpublished editorial strategy alongside
unapproved drafts. Turning the bypass on is one line and puts a red banner
across the console while it's on.

## Running it

1. Apply `supabase/migrations/011_social54.sql`.
2. Fill in whichever platform blocks in `.env.example` you have credentials for.
   Farcaster and Zora work with none.
3. Open `/social54` with an admin wallet. Pull once from the Pulse tab — the
   other tabs get better as the archive deepens.

Tests: `npm test` (the pure helpers in `metrics`, `subjects` and `agents/json`).
