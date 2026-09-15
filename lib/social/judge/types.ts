/**
 * Types for the social judge — Probatio's shape, pointed at posts.
 *
 * The rubric is the point. An LLM asked "is this a good Instagram caption"
 * gives a different answer every time and none of them are checkable. The same
 * model asked "does the first line state a specific fact rather than
 * announcing that we published something — quote it" gives an answer you can
 * disagree with, and disagree with the same way twice.
 *
 * Every criterion here asks about CRAFT, which is readable from the post
 * itself. That is what makes the whole thing work without a single API
 * credential: a screenshot or a pasted caption contains everything needed to
 * grade it. Follower counts and engagement do not enter into it, which at our
 * size is a feature rather than a compromise — see lib/social/scale.ts for why
 * those numbers could not have told us much anyway.
 *
 * Mirrors supabase/migrations/013_social_judge.sql.
 */
import type { SocialPlatform } from '../types';

export type Verdict = 'pass' | 'fail' | 'na';

/**
 * A rubric row.
 *
 * `platform` is nullable: a criterion with no platform applies everywhere.
 * Most of the real ones do — "does the opening line earn the scroll-stop" is
 * not an Instagram question — and scoping every row to a platform would mean
 * maintaining five copies of the same idea and watching them drift.
 */
export interface JudgeCriterion {
  id: string;
  /** Null means it applies to every platform. */
  platform: SocialPlatform | null;
  /** The question, written as something a grader answers yes or no. */
  prompt: string;
  /** What counts as a pass, written for whoever is grading — human or model. */
  guidance: string;
  /**
   * Which outcome is the GOOD one. Almost always 'pass', but some criteria are
   * written so that doing the thing is the failure — "does the caption use
   * marketing language?" — and storing the polarity keeps a judge from scoring
   * those backwards. Same reasoning as lib/eval/types.ts.
   */
  expectedVerdict: 'pass' | 'fail';
  /**
   * Weight, 1-3. Not every criterion matters equally: a post that fails "the
   * opening line is a specific fact" has a bigger problem than one that fails
   * "hashtags are specific rather than broad". A flat score hides that.
   */
  weight: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Where a judged post came from. Affects nothing but the record. */
export type PostSource = 'paste' | 'screenshot' | 'collected';

/**
 * A post being judged.
 *
 * `text` may be empty when the post arrived as a screenshot — the model reads
 * the caption out of the image. What it extracts is stored back here so a
 * saved judgement is still readable once the image is gone.
 */
export interface JudgedPost {
  platform: SocialPlatform;
  /** Ours, or a competitor's. Decides which side of a comparison it sits on. */
  isOurs: boolean;
  /** Handle, where known. Optional — a screenshot carries it in the image. */
  handle: string | null;
  /** Caption text, pasted or extracted from a screenshot. */
  text: string;
  /** Replies, pasted or read from a screenshot. Feeds the sentiment read. */
  comments: string;
  url: string | null;
  source: PostSource;
}

export interface CriterionScore {
  criterionId: string;
  verdict: Verdict;
  /** Why. One or two sentences. */
  rationale: string;
  /**
   * The quote from the post that decides it. A verdict with no evidence is an
   * opinion, and the judge is told to return 'na' rather than invent one.
   */
  evidence: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  /** The specific edit. Not an ambition. */
  change: string;
  rationale: string;
  /** Whether this is a rewrite, a different asset, or new reporting. */
  effort: 'rewrite' | 'new-asset' | 'new-reporting';
}

/** What the audience said, when comments were supplied. */
export interface SentimentRead {
  summary: string;
  /** Null when too few comments to characterize. */
  positiveShare: number | null;
  sampleSize: number;
  themes: { theme: string; valence: 'positive' | 'negative' | 'mixed' | 'neutral'; quote: string }[];
  /** Anything an editor would want to know before tomorrow. */
  flags: string[];
}

export interface Judgement {
  id: string;
  title: string;
  platform: SocialPlatform;
  post: JudgedPost;
  scores: CriterionScore[];
  /** 0-100, weighted. Null when no criterion could be scored. */
  score: number | null;
  verdict: string;
  recommendations: Recommendation[];
  sentiment: SentimentRead | null;
  /** Set when a competitor post was judged alongside ours. */
  comparison: ComparisonRead | null;
  model: string;
  provider: 'claude' | 'openai';
  createdBy: string | null;
  createdAt: string;
  /** Set when the model's reply could not be parsed; its prose is in `verdict`. */
  parseError: string | null;
}

/**
 * Ours against theirs, on craft.
 *
 * Deliberately has no engagement numbers in it. The comparison this console
 * can make honestly at our size is about what the post does, not how far it
 * travelled — and the second one would be a comparison of follower counts
 * wearing a different hat.
 */
export interface ComparisonRead {
  verdict: string;
  /** What theirs did that ours didn't, each quoting their post. */
  advantages: { handle: string; advantage: string; evidence: string }[];
  /** Where ours is genuinely stronger. Not filled in to be kind. */
  oursStronger: string[];
  /** Per-post weighted scores, ours first. */
  scoreboard: { label: string; isOurs: boolean; score: number | null }[];
}

/** Weighted score from a set of verdicts. */
export function weightedScore(
  scores: CriterionScore[],
  criteria: JudgeCriterion[],
): number | null {
  const byId = new Map(criteria.map((c) => [c.id, c]));

  let earned = 0;
  let possible = 0;

  for (const score of scores) {
    const criterion = byId.get(score.criterionId);
    // 'na' is excluded from both halves rather than counted as a failure: a
    // criterion the post gave no way to judge should not drag the score down.
    if (!criterion || score.verdict === 'na') continue;

    const weight = Math.max(1, Math.min(3, criterion.weight));
    possible += weight;

    const good = criterion.expectedVerdict;
    if (score.verdict === good) earned += weight;
  }

  if (possible === 0) return null;
  return Math.round((earned / possible) * 100);
}
