/**
 * Head to head — our post on a subject against theirs.
 *
 * This is the question an editor actually asks after publishing: five outlets
 * posted about the same show, ours did a third of their numbers, why? The
 * comparison is only worth making if it is fair, so the fairness work happens
 * before the model is involved:
 *
 *   • Both sides are scored on the metrics BOTH sides report. Our Instagram
 *     posts carry saves because we own the account; a competitor's, read
 *     through business_discovery, never do. Totalling those against each other
 *     hands us a free advantage the size of our save count, and it would look
 *     like a win.
 *
 *   • Rate, not count. Engagement divided by followers. Otherwise the outlet
 *     with the biggest list wins every comparison it enters, which is a fact
 *     about the list.
 *
 *   • Cross-platform rankings are refused. An Instagram post and a cast are
 *     not comparable objects, and a leaderboard that mixes them produces a
 *     "winner" determined by which platform hands out likes more freely.
 *
 * What is left for the agent is the part that needs reading: what their post
 * did with the same subject that ours did not. Every claim it makes about a
 * competitor has to quote that competitor's post.
 */
import { runAgentChat, CLAUDE_OPUS, OPENAI_SOL } from '@/lib/ai/router';
import { comparableFields, compactNumber, median, rateOn, totalOn } from '../metrics';
import { assessComparability, renderComparabilityRules, type Comparability } from '../scale';
import { splitBySubject } from '../subjects';
import { platformLabel, type AgentProvider, type SocialPlatform, type SocialPost } from '../types';
import { arrayOf, oneOf, parseAgentJson, str } from './json';
import { postRef, renderCaveats, renderPost } from './evidence';

export interface ScoredPost {
  ref: string;
  platform: SocialPlatform;
  handle: string;
  isOurs: boolean;
  url: string;
  publishedAt: string;
  total: number | null;
  rate: number | null;
  followers: number | null;
}

export interface PlatformScoreboard {
  platform: SocialPlatform;
  comparableOn: string[];
  posts: ScoredPost[];
  ourMedianRate: number | null;
  theirMedianRate: number | null;
  /** Whether the two audiences are close enough in size to compare on rate. */
  comparability: Comparability;
  /**
   * Positive means we beat the field on this platform, on rate. Null when the
   * audiences are too far apart for the number to mean anything — see
   * lib/social/scale.ts.
   */
  deltaRate: number | null;
  /** Why this platform's comparison should not be trusted, when it shouldn't. */
  caveat: string | null;
}

export interface Advantage {
  handle: string;
  platform: string;
  advantage: string;
  /** A verbatim quote from their post. No quote, no finding. */
  evidence: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  change: string;
  rationale: string;
}

export interface HeadToHeadReport {
  subject: string;
  verdict: string;
  /** The agent's own statement of how fair this comparison was. */
  parity: string;
  advantages: Advantage[];
  recommendations: Recommendation[];
  model: string;
  parseError: string | null;
}

export interface HeadToHeadOutcome {
  subject: string;
  scoreboards: PlatformScoreboard[];
  ourPosts: SocialPost[];
  theirPosts: SocialPost[];
  /** True when we published nothing on this subject — itself the finding. */
  weDidNotCover: boolean;
}

/**
 * Score both sides, per platform, on the metrics both sides report.
 *
 * Deliberately returns one scoreboard per platform and never a combined one.
 */
export function scoreSubject(posts: SocialPost[], subject: string): HeadToHeadOutcome {
  const split = splitBySubject(posts, subject);
  const matched = [...split.ours, ...split.theirs];

  const byPlatform = new Map<SocialPlatform, SocialPost[]>();
  for (const post of matched) {
    const bucket = byPlatform.get(post.platform);
    if (bucket) bucket.push(post);
    else byPlatform.set(post.platform, [post]);
  }

  const scoreboards: PlatformScoreboard[] = [];
  let index = 0;

  for (const [platform, platformPosts] of byPlatform) {
    const fields = comparableFields(platformPosts);
    const ours = platformPosts.filter((p) => p.isOurs);
    const theirs = platformPosts.filter((p) => !p.isOurs);

    const scored: ScoredPost[] = platformPosts.map((post) => ({
      ref: postRef(post, index++),
      platform: post.platform,
      handle: post.authorHandle,
      isOurs: post.isOurs,
      url: post.url,
      publishedAt: post.publishedAt,
      total: totalOn(post, fields),
      rate: rateOn(post, fields),
      followers: post.authorFollowers,
    }));

    scored.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

    const ourMedianRate = median(
      ours.map((p) => rateOn(p, fields)).filter((v): v is number => v !== null),
    );
    const theirMedianRate = median(
      theirs.map((p) => rateOn(p, fields)).filter((v): v is number => v !== null),
    );

    const comparability = assessComparability(
      ours.reduce<number | null>(
        (max, p) => (typeof p.authorFollowers === 'number' ? Math.max(max ?? 0, p.authorFollowers) : max),
        null,
      ),
      theirs.map((p) => p.authorFollowers),
    );

    scoreboards.push({
      platform,
      comparableOn: [...fields],
      posts: scored,
      ourMedianRate,
      theirMedianRate,
      comparability,
      // Withheld outright when the audiences are too far apart. A delta that
      // cannot be interpreted is worse than no delta: it gets read as a score
      // by anyone skimming, and at this size gap it always reads in our
      // favour. The two medians are still reported separately.
      deltaRate:
        comparability.rateIsMeaningful && ourMedianRate !== null && theirMedianRate !== null
          ? Number((ourMedianRate - theirMedianRate).toFixed(3))
          : null,
      caveat: platformCaveat(fields.length, ours.length, theirs.length, platform, scored),
    });
  }

  scoreboards.sort((a, b) => a.platform.localeCompare(b.platform));

  return {
    subject,
    scoreboards,
    ourPosts: split.ours,
    theirPosts: split.theirs,
    weDidNotCover: split.ours.length === 0 && split.theirs.length > 0,
  };
}

function platformCaveat(
  fieldCount: number,
  ourCount: number,
  theirCount: number,
  platform: SocialPlatform,
  scored: ScoredPost[],
): string | null {
  if (fieldCount === 0) {
    return `No metric is reported by every account on ${platformLabel(platform)} here, so these posts cannot be totalled against each other at all.`;
  }
  if (ourCount === 0) return `We published nothing on this subject on ${platformLabel(platform)}.`;
  if (theirCount === 0) {
    return `No competitor posted about this subject on ${platformLabel(platform)} in the window — there is nothing to compare against.`;
  }
  if (scored.some((s) => s.rate === null)) {
    return `Some posts here have no follower count, so their rate could not be computed and they are ranked below those that could.`;
  }
  return null;
}

const SYSTEM = `You are an editorial analyst for an independent culture magazine. Several outlets — including this one — posted about the same subject. You are explaining why theirs did better or worse than ours, and what to change.

You get a computed SCOREBOARD and the posts themselves. Both sides are scored on the metrics both sides report, and on engagement RATE (engagement divided by followers) rather than raw counts. Use its numbers. Do not rank posts from different platforms against each other — an Instagram like and a Farcaster like are not the same unit, and a mixed leaderboard measures which platform is more generous with likes.

READ THE AUDIENCE SCALE BLOCK FIRST. Rate only corrects for audience size while the two accounts are roughly comparable. Where the scoreboard says the rate is not comparable, it is because the field is an order of magnitude larger than us — and small accounts out-rate large ones structurally, as a property of feed distribution rather than of quality. On those platforms the scoreboard deliberately withholds the delta, and you must not reconstruct one or claim we came out ahead. Our rate looking better there is arithmetic, not a result.

RULES YOU DO NOT BREAK:

1. QUOTE OR DROP IT. Every advantage you claim a competitor has MUST quote their post verbatim. If you cannot quote it, you have not found it. Never invent a quote, never merge two posts into one, and never attribute to a competitor something they did not write.

2. RECOMMENDATIONS ARE EDITS TO A POST, NOT AMBITIONS. "Post more engaging content" is useless. "Their caption opens with the closure date and ours opens with our own byline — lead with the fact" is useful. Say which recommendations are a caption rewrite and which would need a different photograph, a different asset, or new reporting.

3. FORMAT AND TIMING BEFORE CONTENT. Before concluding that our writing lost, check the cheaper explanations the data shows you: format (video against a link card), posting time, whether ours carried the story link and theirs carried the image, cadence. An outlet posting three times about a subject to our once is a distribution difference, not a writing one.

4. SMALL NUMBERS ARE SMALL. If a comparison rests on one post a side, say so and lower your confidence. Never generalize from a single pair to "our audience prefers X". When our post drew a handful of engagements, the difference between 3 and 7 is not a signal about the writing — do not build an explanation on top of it.

4b. WHAT TO PRODUCE WHEN THE SCOREBOARD CANNOT DECIDE. On a platform marked not comparable, the useful analysis is not who won. It is what their post DID that ours did not — what it led with, what it quoted, what it showed, when it ran, how many times they returned to the subject. Those are craft observations, they hold at any audience size, and they are what we can actually act on. Write those. Put the numbers aside and say plainly that you are doing so.

5. NOT COVERING IT IS ITS OWN FINDING. If we published nothing on this subject, do not analyze our absent post. State plainly that the field covered it and we did not, say whether it looks like ours to cover, and stop.

6. IF WE WON, SAY SO. Do not manufacture a deficit. If our rate beat the field, explain what carried it so it can be repeated.

7. READ THE CAVEATS. A platform where only one side has data is not a platform we dominate.

Return strict JSON only, no markdown fences, in exactly this shape:
{
  "verdict": "3-5 sentences: the honest reason the numbers came out this way.",
  "parity": "one or two sentences on how fair this comparison actually is — sample sizes, missing metrics, one-sided platforms.",
  "advantages": [ { "handle": "@theirs", "platform": "instagram", "advantage": "what they did that we didn't", "evidence": "verbatim quote from their post" } ],
  "recommendations": [ { "priority": "high|medium|low", "change": "the specific edit", "rationale": "why it moves the number" } ]
}`;

export async function analyzeHeadToHead(opts: {
  provider: AgentProvider;
  outcome: HeadToHeadOutcome;
  caveats: string[];
}): Promise<HeadToHeadReport> {
  const { provider, outcome, caveats } = opts;
  const model = provider === 'claude' ? CLAUDE_OPUS : OPENAI_SOL;

  const refs = new Map<string, string>();
  for (const board of outcome.scoreboards) {
    for (const scored of board.posts) refs.set(`${scored.platform}:${scored.url}`, scored.ref);
  }
  const refFor = (post: SocialPost, fallback: number) =>
    refs.get(`${post.platform}:${post.url}`) ?? postRef(post, fallback);

  const prompt = [
    `SUBJECT: ${outcome.subject}`,
    '',
    renderCaveats(caveats),
    renderComparabilityRules(outcome.scoreboards.map((b) => b.comparability)),
    renderScoreboards(outcome),
    '',
    outcome.ourPosts.length === 0
      ? 'OUR POSTS: none. We published nothing about this subject in the collected window. See rule 5.'
      : `OUR POSTS\n${outcome.ourPosts.map((p, i) => renderPost(p, refFor(p, i))).join('\n\n')}`,
    '',
    outcome.theirPosts.length === 0
      ? 'COMPETITOR POSTS: none found on this subject in the window.'
      : `COMPETITOR POSTS\n${outcome.theirPosts.map((p, i) => renderPost(p, refFor(p, i + 50))).join('\n\n')}`,
  ].join('\n');

  const raw = await runAgentChat({
    system: SYSTEM,
    message: prompt,
    maxTokens: Math.min(14_000, 3_000 + outcome.theirPosts.length * 500),
    maxRounds: 1,
    preferredProvider: provider,
    openaiModel: OPENAI_SOL,
    logTag: `social54/head-to-head:${provider}`,
  });

  return { ...parseHeadToHead(raw, outcome.subject), model };
}

export function renderScoreboards(outcome: HeadToHeadOutcome): string {
  if (outcome.scoreboards.length === 0) {
    return `SCOREBOARD\n  No posts in the collected window matched "${outcome.subject}" — from us or from any competitor. That is a fact about this pull, not about the subject's coverage.\n`;
  }

  const lines: string[] = ['SCOREBOARD — computed, per platform. Do not rank across platforms.', ''];

  for (const board of outcome.scoreboards) {
    lines.push(`── ${platformLabel(board.platform).toUpperCase()} ──`);
    lines.push(
      `   scored on: ${board.comparableOn.length ? board.comparableOn.join(' + ') : 'nothing comparable'}`,
    );
    if (board.caveat) lines.push(`   ⚠ ${board.caveat}`);
    if (!board.comparability.rateIsMeaningful && board.posts.some((p) => !p.isOurs)) {
      lines.push(`   ⚠ RATE NOT COMPARABLE HERE. ${board.comparability.explanation}`);
    }
    for (const post of board.posts) {
      lines.push(
        `   [${post.ref}] ${post.isOurs ? 'OURS      ' : 'competitor'} @${post.handle}` +
          `  ${post.publishedAt.slice(0, 10)}` +
          `  engagement:${compactNumber(post.total)}` +
          `  followers:${compactNumber(post.followers)}` +
          `  rate:${post.rate === null ? '—' : `${post.rate.toFixed(3)}%`}`,
      );
    }
    if (board.deltaRate !== null) {
      lines.push(
        `   Our median rate ${board.ourMedianRate?.toFixed(3)}% vs theirs ${board.theirMedianRate?.toFixed(3)}% ` +
          `(${board.deltaRate >= 0 ? '+' : ''}${board.deltaRate} pts — ${board.deltaRate >= 0 ? 'ahead' : 'behind'}).`,
      );
    } else if (board.ourMedianRate !== null && board.theirMedianRate !== null) {
      // Both medians, no delta and no verdict word. Stated this way on purpose:
      // the numbers are real and worth seeing, the subtraction is not.
      lines.push(
        `   Our median rate ${board.ourMedianRate.toFixed(3)}%, theirs ${board.theirMedianRate.toFixed(3)}%. ` +
          'No delta is given — see the scale warning above. Neither side "wins" this.',
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function parseHeadToHead(raw: string, subject: string): Omit<HeadToHeadReport, 'model'> {
  const parsed = parseAgentJson<any>(raw);

  if (!parsed.ok) {
    return {
      subject,
      verdict: parsed.raw.slice(0, 4_000),
      parity: '',
      advantages: [],
      recommendations: [],
      parseError: parsed.error,
    };
  }

  const d = parsed.data;
  return {
    subject,
    verdict: str(d?.verdict, 4_000),
    parity: str(d?.parity, 800),
    advantages: arrayOf<Advantage>(d?.advantages, (a) => {
      const advantage = str(a?.advantage, 800);
      if (!advantage) return null;
      return {
        handle: str(a?.handle, 80),
        platform: str(a?.platform, 40),
        advantage,
        evidence: str(a?.evidence, 800),
      };
    }),
    recommendations: arrayOf<Recommendation>(d?.recommendations, (r) => {
      const change = str(r?.change, 800);
      if (!change) return null;
      return {
        priority: oneOf(r?.priority, ['high', 'medium', 'low'] as const, 'medium'),
        change,
        rationale: str(r?.rationale, 800),
      };
    }),
    parseError: null,
  };
}

export function renderHeadToHeadSummary(r: HeadToHeadReport): string {
  const lines: string[] = [];
  if (r.verdict) lines.push(r.verdict, '');
  if (r.parity) lines.push(`HOW FAIR IS THIS: ${r.parity}`, '');

  if (r.advantages.length) {
    lines.push('WHAT THEY DID THAT WE DIDN’T:');
    for (const a of r.advantages) {
      lines.push(`  • ${a.advantage} — @${a.handle} (${a.platform})`);
      if (a.evidence) lines.push(`      "${a.evidence}"`);
    }
    lines.push('');
  }

  if (r.recommendations.length) {
    lines.push('CHANGE THIS:');
    for (const rec of r.recommendations) {
      lines.push(`  [${rec.priority.toUpperCase()}] ${rec.change}`);
      if (rec.rationale) lines.push(`      ${rec.rationale}`);
    }
  }

  return lines.join('\n');
}
