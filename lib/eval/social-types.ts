/**
 * The social audit's shapes and constants, with no provider SDK behind them.
 *
 * Split out of ./social-judge.ts because that module imports lib/ai/router.ts
 * as a value, and the router constructs the Anthropic and OpenAI SDKs. Any
 * CLIENT module that imported a value from social-judge — a constant, an id
 * helper — pulled both SDKs into the browser bundle, and `fs` with them, which
 * fails the build outright.
 *
 * Types alone were never the problem; TypeScript erases those. It is the value
 * imports that travel. So everything here is either a type or a plain constant,
 * and nothing here imports anything that is not.
 *
 * ./social-judge.ts re-exports all of it, so existing imports keep working.
 */
import type { ImageInput } from '@/lib/ai/router';
import type { SocialPlatform, Verdict } from './types';

/** One post under audit: what was pasted, plus what was filmed or screenshotted. */
export interface SocialSubmission {
  /** Free-text name for this side — "us", "@love.watts", "Hyperallergic". */
  label: string;
  handle?: string | null;
  /** Link to the post itself. */
  url?: string | null;
  /** Link to the article the post points at. */
  storyUrl?: string | null;
  /**
   * The article, fetched server-side from `storyUrl`.
   *
   * This is what turns "does every claim in the post hold up against the story
   * it points at" from a permanent N/A into a real verdict — the criterion is
   * unanswerable from a caption alone, and abstaining on it every time was the
   * judge correctly reporting that we had never given it the material.
   */
  story?: { title: string | null; text: string; url: string } | null;
  /** Anything else worth telling the judge, in the person's own words. */
  notes?: string;
  /** The caption, where it was pasted rather than left to be read from pixels. */
  text?: string;
  /** Replies, where they were pasted. */
  comments?: string;
  images?: ImageInput[];
  /**
   * Seconds into a recording for each image, where they came from one. Passed
   * through to the prompt so a Story sequence is read in the order it was
   * filmed rather than as a pile of unrelated pictures.
   */
  frameTimestamps?: number[];
}

/**
 * Post ids, assigned by us rather than by the model.
 *
 * The judge echoes them back on each block of scores. Assigning them here is
 * what lets a judge that invents an id, reorders the posts, or grades the same
 * post twice be caught at parse time — rather than silently attaching a
 * competitor's verdicts to our own post, which would be invisible in the UI and
 * wrong in the database.
 */
export const OUR_POST_ID = 'ours';
export const theirPostId = (index: number) => `theirs-${index + 1}`;

/** The four things the audit compares. Named by the editor, not by us. */
export const DIMENSIONS = ['style', 'tone', 'content', 'delivery'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_BRIEFS: Record<Dimension, string> = {
  style: 'what it looks like — the photograph, the crop, the type, the grid it sits in',
  tone: 'what it sounds like — register, distance, humour, who it is talking to',
  content: 'what is actually in it — the facts, the quotes, the claims, what is withheld',
  delivery: 'how it lands — the order things arrive in, the pacing, the ask, the truncation',
};

/** One post under audit: what was pasted, plus what was filmed or screenshotted. */
export interface SocialSubmission {
  /** Free-text name for this side — "us", "@love.watts", "Hyperallergic". */
  label: string;
  handle?: string | null;
  /** Link to the post itself. */
  url?: string | null;
  /** Link to the article the post points at. */
  storyUrl?: string | null;
  /**
   * The article, fetched server-side from `storyUrl`.
   *
   * This is what turns "does every claim in the post hold up against the story
   * it points at" from a permanent N/A into a real verdict — the criterion is
   * unanswerable from a caption alone, and abstaining on it every time was the
   * judge correctly reporting that we had never given it the material.
   */
  story?: { title: string | null; text: string; url: string } | null;
  /** Anything else worth telling the judge, in the person's own words. */
  notes?: string;
  /** The caption, where it was pasted rather than left to be read from pixels. */
  text?: string;
  /** Replies, where they were pasted. */
  comments?: string;
  images?: ImageInput[];
  /**
   * Seconds into a recording for each image, where they came from one. Passed
   * through to the prompt so a Story sequence is read in the order it was
   * filmed rather than as a pile of unrelated pictures.
   */
  frameTimestamps?: number[];
}

export interface CriterionScore {
  criterionId: string;
  verdict: Verdict;
  rationale: string;
  evidence: string;
}

export interface DifferenceRead {
  dimension: Dimension;
  ours: string;
  theirs: string;
  difference: string;
  evidence: string;
  advantage: 'ours' | 'theirs' | 'neither';
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  change: string;
  rationale: string;
  /** What the fix actually costs. A rewrite is not a reshoot. */
  effort: 'rewrite' | 'new-asset' | 'new-reporting';
}

export interface SentimentRead {
  summary: string;
  positiveShare: number | null;
  themes: { theme: string; valence: 'positive' | 'negative' | 'mixed' | 'neutral'; quote: string }[];
  flags: string[];
}

/**
 * One post, graded on its own.
 *
 * Every submitted post gets one of these — ours and each competitor's — so the
 * audit answers "how good is this post" for each of them and not only for ours.
 *
 * A NOTE ON WHAT A COMPETITOR'S SCORE MEANS, because it is easy to misread.
 * The rubric is Knead's: it encodes what WE are trying to do, house voice
 * included. Scoring a competitor against it does not say "their post is a 62
 * out of 100 post". It says "their post does 62% of the things we are trying
 * to do". That is a genuinely useful number — if theirs scores higher than
 * ours on our own rubric, that is worth knowing and hard to argue with — but
 * it is not a verdict on their work, and the UI says so.
 */
export interface PostJudgement {
  /** 'ours', 'theirs-1', … — assigned by us and echoed back by the judge. */
  postId: string;
  label: string;
  isOurs: boolean;
  scores: CriterionScore[];
  score: number | null;
  verdict: string;
  /** Caption and replies as the model read them, from the images where needed. */
  extracted: { text: string; comments: string; handle: string | null };
}

/** The head-to-head, across every post that was submitted. */
export interface ComparisonRead {
  /** postId of the strongest post, or null when the judge declined to pick. */
  leaderId: string | null;
  /** Why it leads, and what separates the field. 3-5 sentences. */
  summary: string;
  /** What ours would have to do to close the gap. Empty when ours leads. */
  toClose: string[];
}

export interface SocialJudgement {
  /** Ours first, then each competitor in submission order. */
  posts: PostJudgement[];
  /** Ours against theirs on style, tone, content and delivery. */
  differences: DifferenceRead[];
  /** The head-to-head. Null when only one post was submitted. */
  comparison: ComparisonRead | null;
  recommendations: Recommendation[];
  sentiment: SentimentRead | null;
  parseError: string | null;
  /** Non-fatal: an image too large, a competitor post that was trimmed. */
  warnings: string[];
}

/**
 * Our post's judgement.
 *
 * Ours is the one whose verdicts go to eval_results and can be overridden by
 * hand, so enough call sites need it that reaching into the array by predicate
 * everywhere invites someone to get the predicate wrong.
 */
export function oursOf(judgement: SocialJudgement): PostJudgement | null {
  return judgement.posts.find((p) => p.isOurs) ?? null;
}

export interface PostRoster {
  id: string;
  label: string;
  isOurs: boolean;
}

/**
 * Every post that will be graded, in the order it is presented.
 *
 * Ids are assigned here rather than by the model, so a judge that invents one,
 * reorders the posts or grades one twice is caught at parse time instead of
 * silently attaching a competitor's verdicts to our own post.
 *
 * Extracted so the property that matters can be asserted directly: every
 * submission handed in appears exactly once. The bug this guards against was
 * competitors being collected in full and then never reaching the judge at all.
 */
export function rosterFor(ours: SocialSubmission, theirs: SocialSubmission[]): PostRoster[] {
  return [
    { id: OUR_POST_ID, label: ours.label, isOurs: true },
    ...theirs.map((submission, i) => ({
      id: theirPostId(i),
      label: submission.label || `Competitor ${i + 1}`,
      isOurs: false,
    })),
  ];
}
