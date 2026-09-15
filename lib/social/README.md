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
  scale.ts            whether a comparison is meaningful at these audience sizes
  feed-parse.ts       hand-rolled RSS/Atom reader; no dependency, tolerant of real feeds
  editorial.ts        what the field PUBLISHED, via their feeds — no credentials needed
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

## The second rule: rate only corrects for size within a size band

Engagement rate stops the bigger account winning automatically — but only while
the two accounts are within roughly an order of magnitude of each other. Small
accounts out-rate large ones *structurally*, because of how feeds distribute,
not because of quality.

At a few hundred followers against a national title, a rate comparison is
guaranteed to flatter us and guaranteed to be meaningless: we'd "lead the field"
on every platform for exactly as long as we stayed small. `scale.ts` decides
whether a rate delta is allowed to become a verdict; where it isn't, the
scoreboard withholds the delta, the headline reports our own position instead,
and the agents are told in as many words not to claim a win.

Competitor data is never hidden by this — their subjects, cadence, formats and
craft are useful at any size gap. It's only the scoreboard that stops meaning
anything.

Same reasoning in `movement()`: a median going 4 → 8 is four more engagements,
not "+100%", so a percentage is withheld below a real baseline.

## The free half: what they published

Every social API here is gated on the **metrics**. None of them gates the
**journalism**. What a publication printed, and when, is announced by the
publication itself in a format built to be machine-read.

`editorial.ts` sweeps competitor RSS/Atom feeds — no token, no login wall, no
terms-of-service question — and falls back to Tavily search (already configured
for Demeter) for publications with no discoverable feed. It feeds the Trends
agent's coverage-gap analysis.

This matters more than it sounds, and it follows directly from `scale.ts`:
**coverage and cadence are the two comparisons that don't decay across an
audience-size gap.** A magazine with a few hundred followers and one with
several hundred thousand can be compared exactly and fairly on what they chose
to cover and how often. Engagement cannot. So at a large size gap this is the
honest comparison — and it happens to be the free one.

The roster stores a feed URL per competitor. You paste a **homepage**; the feed
is discovered from what the page advertises, then the conventional paths, and
the resolved URL is written back so the lookup happens once. The seed carries
homepages rather than guessed feed paths for the same reason.

Coverage data is labelled hard in the prompt: it carries no engagement
information, and the agent is told never to read a headline count as
popularity.

## Platform limits, stated once

| Platform | Ours | Competitors | Reply text | Cost |
|---|---|---|---|---|
| **Farcaster** | full, public | full, public | Neynar only | **free, no setup** |
| **Zora** | collects, public | collects, public | none | **free, no setup** |
| Instagram (Instagram Login) | full, incl. saves + reach | **none — no `business_discovery` on this path** | ours only | free, needs a Meta app |
| Instagram (Facebook Login) | full, incl. saves + reach | likes/comments/captions via `business_discovery` | ours only | free, needs a Facebook Page |
| X | full `public_metrics` | full `public_metrics` | needs a tier allowing recent search | **usually paid** |
| LinkedIn | full | **none — API scopes reads to pages we administer** | ours only | free, needs API approval |

Instagram picks its path from the credentials present: token alone → Instagram
Login (no Facebook Page required); token plus `INSTAGRAM_BUSINESS_ACCOUNT_ID` →
Facebook Login, which adds competitors. Adding a Page later is one new
environment variable and no code change.

Farcaster is the only platform where competitor data is as complete as our own
*and* free, which is worth weighting accordingly when the numbers disagree.

## Auth

`SOCIAL54_DEMO_MODE` in `demo-mode.ts` is currently **`true`**, matching
`lib/eval/demo-mode.ts`, so `/social54` and every `/api/social/*` route skip the
wallet check. A red banner sits across the console while it's on. Set it to
`false` to restore auth — that's the whole revert.

What that exposes: model spend (each analysis makes an Opus/GPT call on your
key, bounded by the per-route rate limits), unpublished editorial strategy, and
write access to the roster. Not the platform credentials themselves — tokens are
read server-side and never reach the client, so the bypass leaks what the tokens
can *see*, not the tokens.

## Running it

1. Apply `supabase/migrations/011_social54.sql`, then `012_social_feeds.sql`.
2. Open `/social54`. **Farcaster and Zora collect immediately with no
   credentials and no spend** — that's the zero-config path, and it's enough to
   see the console work.
3. Add platforms as you get keys. The Pulse tab lists exactly which variables
   each one still needs, and marks which need a paid tier.
4. Pull once from Pulse. The other tabs get better as the archive deepens —
   macro trend claims unlock at three weeks of history.

Tests: `npm test` (the pure helpers in `metrics`, `subjects` and `agents/json`).
