/**
 * The trend agent — macro drift and micro spikes across the field.
 *
 * The two timescales answer different questions and get confused constantly,
 * so this agent is required to separate them and to label which it is talking
 * about:
 *
 *   MACRO — structural, multiple weeks, survives the next post. A competitor
 *   moving from links to native video. The field converging on a format. A
 *   subject area that keeps returning. These change what we commission.
 *
 *   MICRO — this week, possibly noise. One post that outran its account by 10×.
 *   A tag appearing three times in four days. A single competitor's spike.
 *   These change what we post on Thursday, and they expire.
 *
 * A micro observation dressed as a macro trend is the specific failure worth
 * guarding against: it turns one competitor's lucky post into a strategy memo.
 * The agent is given computed statistics (lib/social/field.ts) rather than
 * asked to eyeball them, and is told exactly how much history the archive
 * actually covers — a macro claim over a nine-day archive is not a macro claim.
 */
import { runAgentChat, CLAUDE_OPUS, OPENAI_SOL } from '@/lib/ai/router';
import { renderFieldStats, type FieldStats } from '../field';
import { arrayOf, oneOf, parseAgentJson, str } from './json';
import { renderCaveats, renderPostBlock } from './evidence';
import type { AgentProvider, SocialPost } from '../types';

export type Horizon = 'macro' | 'micro';
export type Confidence = 'strong' | 'tentative' | 'speculative';

export interface Trend {
  horizon: Horizon;
  headline: string;
  detail: string;
  confidence: Confidence;
  /** Post refs or computed figures the claim rests on. */
  evidence: string;
  /** Which competitors, if any, this is about. */
  accounts: string[];
}

export interface CoverageGap {
  subject: string;
  whoCovered: string;
  /** Whether this is something Knead would plausibly publish. */
  fit: string;
}

export interface TrendReport {
  verdict: string;
  /** What the archive can actually support a macro claim over. */
  historyNote: string;
  trends: Trend[];
  gaps: CoverageGap[];
  /** Concrete, dated things to do in the next week. */
  actions: string[];
  model: string;
  parseError: string | null;
}

const SYSTEM = `You are a strategy analyst for an independent culture magazine, reading its social performance against a set of competitors.

You are given COMPUTED STATISTICS and a sample of posts. The statistics are already calculated — cadence, median engagement, engagement rate, movement between the two halves of the window, format mix, tag divergence. Cite them. Do not recompute them from the post list; if you find yourself doing arithmetic, you are producing a worse version of a number you already have.

SEPARATE THE TWO TIMESCALES. Every trend you report is labelled:
- "macro": structural, spans multiple weeks, will still be true next month. A format shift, a sustained cadence change, a subject area a competitor has committed to.
- "micro": this week, may be noise. One post that outran its account. A tag appearing a few times. A single spike.
A micro observation written as a macro trend turns one lucky post into a strategy. Do not do it.

RULES YOU DO NOT BREAK:

1. HISTORY LIMITS MACRO CLAIMS. You are told how far back the archive reaches. You cannot call anything a multi-week trend if the data covers less than three weeks. In that case say so in "historyNote" and label those observations "micro" with confidence "tentative".

2. THE MOVEMENT FIGURES HAVE A MINIMUM. Where the statistics say movement could not be read because there were too few posts, do not describe that account as rising or falling. Two posts a side is the stated minimum and it is not negotiable.

3. ABSENCE IS NOT BEHAVIOR. Read the DATA CAVEATS. A platform that is unconfigured, failed, or one-sided tells you nothing about what happens there. Never write that a competitor has abandoned a platform, or that we lead one, on the strength of missing data.

4. COMPARE ON THE STATED RULER. Each platform lists which metrics every account there reports. A comparison built on a metric only one side has is not a comparison. The statistics already respect this; your prose must too.

5. RATE, NOT COUNT. A competitor with twenty times our following will out-count us on every post. That is a fact about their following. Engagement RATE is the comparison that means something, and it is computed for you.

6. GAPS ARE CHECKED AGAINST FIT. A subject the field is covering is only a gap if this magazine would plausibly publish it — it covers art, music, food, technology, creative culture, and independent journalism. A crypto-price thread is not a gap in our coverage.

7. ACTIONS ARE DOABLE THIS WEEK. "Improve video strategy" is not an action. "Cut the link-only posts on X — our three link posts median 0.4% against 1.1% for the native-text ones" is.

Return strict JSON only, no markdown fences, in exactly this shape:
{
  "verdict": "3-5 sentences: where we actually stand against this field right now, and the one thing that would move it.",
  "historyNote": "one or two sentences on what this data can and cannot support",
  "trends": [
    { "horizon": "macro|micro", "headline": "short", "detail": "what is happening and why it matters",
      "confidence": "strong|tentative|speculative", "evidence": "the figures or post refs behind it", "accounts": ["@handle"] }
  ],
  "gaps": [ { "subject": "what the field covered that we did not", "whoCovered": "@handle", "fit": "why this is or is not ours to publish" } ],
  "actions": ["specific thing to do this week"]
}`;

export async function analyzeTrends(opts: {
  provider: AgentProvider;
  stats: FieldStats;
  posts: SocialPost[];
  caveats: string[];
  /** How far back the post archive reaches, in days. Bounds every macro claim. */
  archiveDays: number | null;
}): Promise<TrendReport> {
  const { provider, stats, posts, caveats, archiveDays } = opts;
  const model = provider === 'claude' ? CLAUDE_OPUS : OPENAI_SOL;

  const ours = renderPostBlock('OUR POSTS (top by engagement rate)', posts.filter((p) => p.isOurs), {
    maxPosts: 12,
  });
  const theirs = renderPostBlock(
    'COMPETITOR POSTS (top by engagement rate)',
    posts.filter((p) => !p.isOurs),
    { maxPosts: 25, startIndex: 100 },
  );

  const history =
    archiveDays === null
      ? 'ARCHIVE DEPTH: unknown — treat every observation as micro.'
      : `ARCHIVE DEPTH: the stored post archive reaches back ${archiveDays} day(s). ${
          archiveDays < 21
            ? 'That is under three weeks, so NOTHING here supports a macro trend claim. Label observations micro and say so in historyNote.'
            : 'That is enough history for macro claims, where the figures support them.'
        }`;

  const prompt = [
    renderCaveats(caveats),
    history,
    '',
    renderFieldStats(stats),
    ours.text,
    '',
    theirs.text,
  ].join('\n');

  const raw = await runAgentChat({
    system: SYSTEM,
    message: prompt,
    maxTokens: 12_000,
    maxRounds: 1,
    preferredProvider: provider,
    openaiModel: OPENAI_SOL,
    logTag: `social54/trends:${provider}`,
  });

  return { ...parseTrends(raw), model };
}

export function parseTrends(raw: string): Omit<TrendReport, 'model'> {
  const parsed = parseAgentJson<any>(raw);

  if (!parsed.ok) {
    return {
      verdict: parsed.raw.slice(0, 4_000),
      historyNote: '',
      trends: [],
      gaps: [],
      actions: [],
      parseError: parsed.error,
    };
  }

  const d = parsed.data;
  return {
    verdict: str(d?.verdict, 4_000),
    historyNote: str(d?.historyNote, 800),
    trends: arrayOf<Trend>(d?.trends, (t) => {
      const headline = str(t?.headline, 300);
      if (!headline) return null;
      return {
        horizon: oneOf(t?.horizon, ['macro', 'micro'] as const, 'micro'),
        headline,
        detail: str(t?.detail, 2_000),
        confidence: oneOf(t?.confidence, ['strong', 'tentative', 'speculative'] as const, 'tentative'),
        evidence: str(t?.evidence, 1_000),
        accounts: arrayOf<string>(t?.accounts, (a) => str(a, 80) || null),
      };
    }),
    gaps: arrayOf<CoverageGap>(d?.gaps, (g) => {
      const subject = str(g?.subject, 300);
      if (!subject) return null;
      return { subject, whoCovered: str(g?.whoCovered, 200), fit: str(g?.fit, 600) };
    }),
    actions: arrayOf<string>(d?.actions, (a) => str(a, 500) || null),
    parseError: null,
  };
}

export function renderTrendSummary(r: TrendReport): string {
  const lines: string[] = [];
  if (r.verdict) lines.push(r.verdict, '');
  if (r.historyNote) lines.push(`WHAT THIS DATA SUPPORTS: ${r.historyNote}`, '');

  const macro = r.trends.filter((t) => t.horizon === 'macro');
  const micro = r.trends.filter((t) => t.horizon === 'micro');

  for (const [label, group] of [
    ['MACRO — structural, multi-week', macro],
    ['MICRO — this week, expires', micro],
  ] as const) {
    if (!group.length) continue;
    lines.push(`${label}:`);
    for (const t of group) {
      lines.push(`  [${t.confidence}] ${t.headline}`);
      if (t.detail) lines.push(`      ${t.detail}`);
      if (t.evidence) lines.push(`      evidence: ${t.evidence}`);
      if (t.accounts.length) lines.push(`      accounts: ${t.accounts.join(', ')}`);
    }
    lines.push('');
  }

  if (r.gaps.length) {
    lines.push('COVERAGE GAPS:');
    for (const g of r.gaps) {
      lines.push(`  • ${g.subject} — covered by ${g.whoCovered}`);
      if (g.fit) lines.push(`      ${g.fit}`);
    }
    lines.push('');
  }

  if (r.actions.length) {
    lines.push('THIS WEEK:');
    for (const a of r.actions) lines.push(`  → ${a}`);
  }

  return lines.join('\n');
}
