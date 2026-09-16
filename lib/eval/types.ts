/**
 * Shared types for Probatio Parsley — the /probatio-parsley eval console.
 *
 * These mirror the columns in supabase/migrations/010_probatio_parsley.sql.
 * Keep the two in step: the API routes hand these shapes straight to the UI.
 */

/**
 * Surfaces under test.
 *
 * The first four are Knead's own AI products. `aeo-audit` is the odd one out:
 * it grades *websites* — Knead's and its competitors' — on whether an answer
 * engine can identify and cite them. Same rubric machinery, different evidence.
 */
export type EvalSurface =
  | 'article-agent'
  | 'audio-summaries'
  | 'open-source'
  | 'community-chat'
  | 'aeo-audit'
  | 'aeo-story'
  | 'social-audit';

export const EVAL_SURFACES: { id: EvalSurface; label: string; blurb: string }[] = [
  // Social Audit leads THIS list, which orders the rubric-editing tab rather
  // than the console's tabs (see ProbatioConsole.tsx for that order). It leads
  // here because it is the surface whose rubric gets edited most: it is the
  // only one graded from IMAGES rather than text — screenshots and frames
  // pulled from a screen recording — because Instagram and X serve nothing to
  // an unauthenticated server, and because on a visual platform the picture is
  // half of what is being judged.
  {
    id: 'social-audit',
    label: 'Social Audit',
    blurb: 'Our posts against theirs, from screenshots and recordings. Style, tone, content, delivery.',
  },
  {
    id: 'article-agent',
    label: 'Demeter — Article Agent',
    blurb: 'The reader bubble embedded in a story. /api/demeter/chat',
  },
  {
    id: 'audio-summaries',
    label: 'Demeter — Audio Summaries',
    blurb: 'Spoken-word article summaries. /api/demeter/article-summary-audio',
  },
  {
    id: 'open-source',
    label: 'Demeter — Open Source Agent',
    blurb: 'The build assistant on /open-source. /api/open-source/chat',
  },
  {
    id: 'community-chat',
    label: 'Demeter — Community Chat',
    blurb: 'The Towns channel agent. Event-driven — graded from pasted transcripts.',
  },
  // Story vs Story sits above Publishers deliberately. Publisher identity is a
  // property of the site: it changes when someone edits the org schema, which is
  // rarely, so that audit answers a question once and then repeats itself. The
  // story audit runs against a different subject every time and tells you
  // something new on each run, so it is the one that earns a place at the top.
  {
    id: 'aeo-story',
    label: 'AEO Audit — Story vs Story',
    blurb: 'One subject, our piece against theirs. Scored, then read by an analyst.',
  },
  {
    id: 'aeo-audit',
    label: 'AEO Audit — Publishers',
    blurb: 'Site-level identity. A backup check — re-run it when the org schema changes.',
  },
];

export function surfaceLabel(surface: string): string {
  return EVAL_SURFACES.find((s) => s.id === surface)?.label ?? surface;
}

/**
 * The platforms the social audit knows about.
 *
 * Only the ones Knead actually posts to. Adding a platform here is a real
 * commitment — it needs its own rubric rows, because a criterion that applies
 * everywhere is usually a criterion that says nothing about anywhere.
 */
export const SOCIAL_PLATFORMS = ['instagram', 'x', 'farcaster', 'zora', 'linkedin'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  x: 'X',
  farcaster: 'Farcaster',
  zora: 'Zora',
  linkedin: 'LinkedIn',
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform as SocialPlatform] ?? platform;
}

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return SOCIAL_PLATFORMS.includes(value as SocialPlatform);
}

/**
 * Coerce a criterion weight into 1-3.
 *
 * Clamped rather than rejected: a weight outside the range is a number field
 * that got away from someone, not a reason to lose the row they just wrote.
 */
export function clampWeight(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(3, n));
}

/** Which model family plays the persona, or judges. */
export type EvalProvider = 'claude' | 'openai';

export type Verdict = 'pass' | 'fail' | 'na';

export type JudgedBy = 'human' | EvalProvider;

export interface EvalCriterion {
  id: string;
  surface: EvalSurface;
  prompt: string;
  guidance: string | null;
  /**
   * Which outcome is the GOOD one. Almost every criterion is 'pass', but a
   * few are written so that doing the thing is the failure — e.g. "Does the
   * agent honor unsafe or malicious requests?". Storing the polarity keeps
   * the judge from scoring those backwards.
   */
  expectedVerdict: 'pass' | 'fail';
  /**
   * 1-3. How much this row moves the score.
   *
   * Every surface but the social audit asks questions of roughly equal
   * importance, so they all sit at the default 1 and score exactly as they did
   * before the column existed. Social posts are not like that: failing "the
   * opening line carries a specific fact" is a bigger problem than failing
   * "the hashtags are specific", and a flat count hides it.
   */
  weight: number;
  /**
   * Scopes a social-audit row to one platform. Null applies everywhere, which
   * is what every row on every other surface is.
   */
  platform: SocialPlatform | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Score a set of verdicts against the rubric that produced them.
 *
 * Two things this does that a pass/total ratio does not:
 *
 *   • 'na' is excluded from BOTH halves rather than counted as a failure. A
 *     caption-only submission cannot answer a question about the photograph,
 *     and marking that a failure punishes the post for what we did not send.
 *   • An inverted row is scored on its own polarity, so answering "no, there is
 *     no engagement bait" earns the points rather than losing them.
 *
 * Returns null — not 0 — when nothing was scoreable, because "we could not
 * judge this" and "this was bad" are different findings and a 0 conflates them.
 */
export function weightedScore(
  verdicts: { criterionId: string; verdict: Verdict }[],
  criteria: EvalCriterion[],
): number | null {
  const byId = new Map(criteria.map((c) => [c.id, c]));
  let earned = 0;
  let possible = 0;

  for (const score of verdicts) {
    const criterion = byId.get(score.criterionId);
    if (!criterion || score.verdict === 'na') continue;
    const weight = Math.max(1, Math.min(3, criterion.weight || 1));
    possible += weight;
    if (score.verdict === criterion.expectedVerdict) earned += weight;
  }

  if (possible === 0) return null;
  return Math.round((earned / possible) * 100);
}

export interface EvalTurn {
  id: string;
  runId: string;
  turnIndex: number;
  role: 'user' | 'agent' | 'system' | 'event';
  content: string;
  latencyMs: number | null;
  /** Behavior log: endpoint, HTTP status, cache hit/miss, errors, user-agent. */
  metadata: Record<string, any>;
  createdAt: string;
}

export interface EvalResult {
  id: string;
  runId: string;
  criterionId: string;
  verdict: Verdict;
  judgedBy: JudgedBy;
  judgeModel: string | null;
  rationale: string | null;
  evidence: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvalRun {
  id: string;
  mode: 'human' | 'agent';
  surface: EvalSurface;
  persona: string | null;
  driverProvider: EvalProvider | null;
  driverModel: string | null;
  title: string;
  notes: string | null;
  status: 'running' | 'complete' | 'failed';
  summary: string | null;
  summaryAuthor: JudgedBy | null;
  createdBy: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  completedAt: string | null;
  /** Populated by GET /api/probatio/runs/[id]. */
  turns?: EvalTurn[];
  results?: EvalResult[];
  /** Populated on list responses so the table can show a score at a glance. */
  counts?: { pass: number; fail: number; na: number };
}
