/**
 * Rebuilding a social audit's findings from what was saved.
 *
 * Same reasoning as ./aeo-replay.ts: reopening a saved audit dropped you into
 * the transcript, which is every finding in the least readable form it takes.
 * The scoreboard, the per-post grading and the four dimensions were all
 * rendered from React state that only a live run ever filled.
 *
 * WHERE EACH PIECE COMES FROM, and why it is split that way:
 *
 *   OUR VERDICTS come from eval_results, not from the turn. That table is the
 *   one a human can override on the Human Evaluation tab, so reading it back
 *   means a reopened audit shows YOUR verdict where you replaced the model's —
 *   which is the entire point of having the override.
 *
 *   THEIR VERDICTS come from their turn's metadata, because that is where the
 *   route puts them: eval_results means "verdicts about our work", and nobody
 *   hand-grades a competitor against our house-voice row.
 *
 *   THE COMPARISON, the dimensions and the recommendations come off the summary
 *   turn, which is where they were written whole.
 */
// From ./social-types, never ./social-judge. The judge imports lib/ai/router
// as a value, and this module is reached from a client component — importing a
// value through it would put the Anthropic and OpenAI SDKs in the browser
// bundle and fail the build on a missing `fs`.
import {
  DIMENSIONS,
  type ComparisonRead,
  type CriterionScore,
  type DifferenceRead,
  type Dimension,
  type PostJudgement,
  type Recommendation,
  type SentimentRead,
  type SocialJudgement,
} from './social-types';
import { weightedScore, type EvalCriterion, type EvalResult, type EvalRun, type EvalTurn, type Verdict } from './types';

export interface ReplayedSocialRun {
  judgement: SocialJudgement & { model: string };
  platform: string | null;
  subject: string | null;
  /** False when a post turn was missing, so the tab can say the rebuild is partial. */
  complete: boolean;
}

function readScores(value: unknown): CriterionScore[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row: any) => {
      const criterionId = String(row?.criterionId ?? '');
      if (!criterionId) return null;
      const verdict: Verdict = ['pass', 'fail', 'na'].includes(row?.verdict) ? row.verdict : 'na';
      return {
        criterionId,
        verdict,
        rationale: String(row?.rationale ?? ''),
        evidence: String(row?.evidence ?? ''),
      };
    })
    .filter((s): s is CriterionScore => s !== null);
}

/**
 * Our verdicts, preferring a human's over the model's.
 *
 * eval_results holds both side by side under different `judged_by` values. A
 * reopened audit that showed the model's verdict where somebody had overridden
 * it by hand would be showing the wrong one.
 */
function ourScoresFromResults(results: EvalResult[]): CriterionScore[] {
  const best = new Map<string, EvalResult>();
  for (const row of results) {
    const existing = best.get(row.criterionId);
    if (!existing || row.judgedBy === 'human') best.set(row.criterionId, row);
  }
  return [...best.values()].map((row) => ({
    criterionId: row.criterionId,
    verdict: row.verdict,
    rationale: row.rationale ?? '',
    evidence: row.evidence ?? '',
  }));
}

export function replaySocialRun(
  run: EvalRun,
  turns: EvalTurn[],
  criteria: EvalCriterion[],
): ReplayedSocialRun | null {
  if (run.surface !== 'social-audit') return null;

  const metadata = run.metadata ?? {};
  const ordered = [...turns].sort((a, b) => a.turnIndex - b.turnIndex);

  // A post turn is one carrying a postId. The summary turn has the scoreboard
  // but no postId, so the two never collide.
  const postTurns = ordered.filter((t) => t.metadata?.postId);
  const summaryTurn = ordered.find((t) => Array.isArray(t.metadata?.scoreboard));
  const warningsTurn = ordered.find((t) => Array.isArray(t.metadata?.warnings));

  const board: any[] = Array.isArray(summaryTurn?.metadata?.scoreboard)
    ? summaryTurn!.metadata.scoreboard
    : Array.isArray(metadata.scoreboard)
    ? metadata.scoreboard
    : [];

  // Nothing to rebuild. A run that failed before the judge replied has no post
  // turns at all, and drawing an empty scoreboard for it would look like a
  // measurement of zero rather than an audit that never finished.
  if (postTurns.length === 0 && board.length === 0) return null;

  const ourResults = ourScoresFromResults(run.results ?? []);
  let complete = true;

  // The scoreboard is the roster: it names every post the run graded, in order,
  // so a post whose turn is missing still appears rather than disappearing from
  // a comparison it was part of.
  const roster = board.length
    ? board.map((entry) => ({
        postId: String(entry?.postId ?? ''),
        label: String(entry?.label ?? ''),
        isOurs: Boolean(entry?.isOurs),
        score: typeof entry?.score === 'number' ? entry.score : null,
      }))
    : postTurns.map((t) => ({
        postId: String(t.metadata.postId),
        label: String(t.metadata.label ?? (t.metadata.isOurs ? 'Ours' : 'Competitor')),
        isOurs: Boolean(t.metadata.isOurs),
        score: typeof t.metadata.score === 'number' ? t.metadata.score : null,
      }));

  const posts: PostJudgement[] = roster.map((entry) => {
    const turn = postTurns.find((t) => String(t.metadata.postId) === entry.postId);
    if (!turn) complete = false;

    const scores = entry.isOurs ? ourResults : readScores(turn?.metadata?.scores);

    return {
      postId: entry.postId,
      label: entry.label,
      isOurs: entry.isOurs,
      scores,
      // Recomputed from the verdicts rather than taken from the stored number,
      // so a verdict a human overrode moves the score the way it should.
      score: scores.length ? weightedScore(scores, criteria) : entry.score,
      verdict: String(turn?.metadata?.verdict ?? '') || readVerdict(turn),
      extracted: {
        text: String(turn?.metadata?.extracted?.text ?? ''),
        comments: String(turn?.metadata?.extracted?.comments ?? ''),
        handle: turn?.metadata?.extracted?.handle ?? null,
      },
    };
  });

  const sm = summaryTurn?.metadata ?? {};

  const differenceRows: DifferenceRead[] = (
    Array.isArray(sm.differences)
      ? sm.differences
      : Array.isArray(metadata.differences)
      ? metadata.differences
      : []
  ).filter((row: any) => DIMENSIONS.includes(String(row?.dimension) as Dimension));

  const comparisonRaw = sm.comparison ?? metadata.comparison ?? null;

  return {
    platform: metadata.platform ? String(metadata.platform) : null,
    subject: metadata.subject ? String(metadata.subject) : null,
    complete,
    judgement: {
      posts,
      differences: differenceRows,
      comparison: comparisonRaw
        ? ({
            leaderId: comparisonRaw.leaderId ?? null,
            summary: String(comparisonRaw.summary ?? ''),
            toClose: Array.isArray(comparisonRaw.toClose) ? comparisonRaw.toClose.map(String) : [],
          } as ComparisonRead)
        : null,
      recommendations: (Array.isArray(sm.recommendations)
        ? sm.recommendations
        : Array.isArray(metadata.recommendations)
        ? metadata.recommendations
        : []) as Recommendation[],
      sentiment: (sm.sentiment ?? null) as SentimentRead | null,
      parseError: sm.parseError ? String(sm.parseError) : null,
      warnings: Array.isArray(warningsTurn?.metadata?.warnings)
        ? warningsTurn!.metadata.warnings.map(String)
        : [],
      model: String(sm.model ?? ''),
    },
  };
}

/**
 * The verdict, recovered from a turn's body.
 *
 * A fallback only, for runs saved before the verdict was stored as a field.
 * The body is a header line, the verdict, then the extracted text, so the
 * verdict is everything above the first "CAPTION AS READ" minus that header.
 * Fragile by nature, which is why it is not the primary path.
 */
function readVerdict(turn: EvalTurn | undefined): string {
  if (!turn) return '';
  const body = turn.content ?? '';
  const cut = body.indexOf('CAPTION AS READ:');
  const head = (cut >= 0 ? body.slice(0, cut) : body).trim();
  // Drop the first line, which is "Label (ours) — 62/100" and is already shown
  // by the heading above the verdict.
  const lines = head.split('\n');
  return lines.slice(1).join('\n').trim();
}
