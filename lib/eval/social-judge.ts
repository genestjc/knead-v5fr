/**
 * The social audit — LLM-as-judge for a post, read out of pictures.
 *
 * Every other Probatio surface grades a TRANSCRIPT. This one grades IMAGES:
 * screenshots someone took, or frames sampled out of a screen recording. That
 * is not a compromise made because the APIs were inconvenient — it is the only
 * input that carries the whole post.
 *
 *   • Instagram and X serve nothing useful to an unauthenticated server. A
 *     pasted link gets a login wall. The Graph API wants a Facebook Page, a
 *     review process and a token that expires.
 *   • Even with a token, the API hands back `caption` and `like_count` and
 *     nothing about whether the photograph was any good — and on a visual
 *     platform the photograph is half of why a post works.
 *   • A person looking at their own screen and filming it takes fifteen
 *     seconds, needs no credential, and captures the comment thread, the
 *     pacing of a Story sequence, and the competitor's grid alongside ours.
 *
 * WHAT IT RETURNS, and why in this shape:
 *
 *   SCORES — one verdict per rubric row, each carrying the quote that decides
 *   it. Weighted, because the rows are not equally important.
 *
 *   DIFFERENCES — ours against theirs on style, tone, content and delivery,
 *   one entry per dimension. This is the part the console exists for: "their
 *   post did better" is not usable, "they opened on the closure date and we
 *   opened on our own byline" is.
 *
 *   RECOMMENDATIONS — edits somebody could make this afternoon, each labelled
 *   with what it actually costs.
 *
 * THE RULES IN THE PROMPT each exist because of a specific way an LLM judge
 * goes wrong on this material: agreeing with whatever it is shown, inventing a
 * quote to justify a verdict it already picked, scoring a criterion the post
 * gave it no way to answer, and turning "this could be better" into a
 * recommendation nobody can act on.
 */
import {
  runAgentChat,
  checkImages,
  CLAUDE_OPUS,
  MAX_IMAGES_PER_REQUEST,
  OPENAI_SOL,
  type ImageInput,
} from '@/lib/ai/router';
import { arrayOf, numberInRange, oneOf, parseAgentJson, str } from './json';
import {
  platformLabel,
  weightedScore,
  type EvalCriterion,
  type EvalProvider,
  type SocialPlatform,
  type Verdict,
} from './types';

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
  url?: string | null;
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

export interface SocialJudgement {
  scores: CriterionScore[];
  score: number | null;
  verdict: string;
  differences: DifferenceRead[];
  recommendations: Recommendation[];
  sentiment: SentimentRead | null;
  /** Caption and replies as the model read them, from the images where needed. */
  extracted: { text: string; comments: string; handle: string | null };
  parseError: string | null;
  /** Non-fatal: an image too large, a competitor post that was trimmed. */
  warnings: string[];
}

export interface SocialJudgeInput {
  provider: EvalProvider;
  platform: SocialPlatform;
  criteria: EvalCriterion[];
  ours: SocialSubmission;
  theirs?: SocialSubmission[];
  /** What the post is about, when naming it helps. */
  subject?: string | null;
}

const SYSTEM = `You are the editorial judge for Knead, an independent magazine covering art, music, food, technology, creative culture and independent journalism. You grade social posts against a fixed rubric, and you compare ours against a competitor's.

Your inputs are PICTURES: screenshots, or frames sampled out of a screen recording. Read the captions and any visible replies out of the images — that is what they are for. Also read what the images SHOW, because on a visual platform the photograph is half the post and several criteria turn on it. Where frames carry timestamps, they are in order: treat them as one sequence, not as separate posts.

HOW TO GRADE

For every criterion you are given, return exactly one verdict:
- "pass" — the post does the thing the criterion describes.
- "fail" — it does not.
- "na" — THE MATERIAL GAVE YOU NO WAY TO JUDGE IT. Use this and mean it. A criterion about the image on a caption-only submission is "na". A criterion about factual accuracy when the underlying story was not supplied is "na". Guessing here is worse than abstaining, because an invented verdict is indistinguishable from a real one once it is in the table.

Note each criterion's EXPECTED verdict. A few are written so that doing the thing is the failure — "does the caption use engagement bait?" expects "fail". Answer the question as literally asked; the scoring handles the polarity. Do not invert your answer to be helpful.

RULES YOU DO NOT BREAK

1. QUOTE OR ABSTAIN. Every pass and every fail carries a verbatim quote from the material that decides it. If you cannot quote it, the verdict is "na". Never paraphrase into the evidence field, never assemble a quote from scattered words, and never write a quote that is not in what you were shown. For a criterion about the image, the "quote" is a short literal description of what is visible — "a hand-lettered closing sign taped inside the window, shot from the street".

2. GRADE THE POST, NOT THE SUBJECT. A dull post about a fascinating show is a dull post. A sharp post about a minor opening is a sharp post. You are judging the writing and the asset.

3. DO NOT AGREE BY DEFAULT. Passing everything is the failure mode of this task. If a post is mediocre, most criteria should fail, and saying so plainly is the entire value you add. A rubric that always returns 90 tells nobody anything.

4. COMPARE ON CRAFT, NOT REACH. Say nothing about follower counts, likes, views or who "won" on engagement, even when a screenshot shows those numbers. Knead's accounts are in the hundreds and a competitor's may be in the tens of thousands — a reach comparison would measure audience size and call it craft. Compare what the posts DO: what they lead with, what they quote, what they show, what order it arrives in.

5. THE FOUR DIMENSIONS ARE THE POINT. For each of style, tone, content and delivery, say what ours does, what theirs does, and the difference that matters — not that there is a difference, but what it is and what follows from it. Quote theirs. If one dimension genuinely shows no meaningful difference, say so and set advantage to "neither"; do not manufacture one.

6. RECOMMENDATIONS ARE EDITS SOMEBODY COULD MAKE THIS AFTERNOON. "Improve the hook" is useless. "Open on the 1998 closure date instead of 'We sat down with' — it is the only fact here a stranger would stop for" is useful. Mark each one's effort honestly: "rewrite" if the caption alone changes, "new-asset" if it needs a different image or video, "new-reporting" if it needs a fact we do not have. Do not label something a rewrite when it needs a photograph nobody took.

7. IF IT IS GOOD, SAY SO. Do not manufacture faults. A post that passes on merit should be told what carried it, so it can be repeated.

8. COMMENTS: READ WHAT THEY MEAN. Sarcasm is not praise — "oh great, another think piece" is negative. "This is devastating" about a closure is praise. If fewer than about 15 replies are visible, set positiveShare to null and say the sample is too thin to characterise; a handful of replies is a handful of people, not an audience.

Return strict JSON only, no markdown fences, in exactly this shape:
{
  "extracted": { "text": "our caption as you read it", "comments": "replies as you read them, or empty", "handle": "our account handle if visible, else null" },
  "verdict": "3-5 sentences: what our post does, what it does not, and the one change that would matter most.",
  "scores": [ { "criterionId": "the id given", "verdict": "pass|fail|na", "rationale": "one or two sentences", "evidence": "verbatim quote, or a literal description for image criteria" } ],
  "differences": [ { "dimension": "style|tone|content|delivery", "ours": "what ours does", "theirs": "what theirs does", "difference": "the difference that matters and what follows from it", "evidence": "verbatim quote or literal description from THEIR post", "advantage": "ours|theirs|neither" } ],
  "recommendations": [ { "priority": "high|medium|low", "change": "the specific edit", "rationale": "why it matters", "effort": "rewrite|new-asset|new-reporting" } ],
  "sentiment": null or { "summary": "...", "positiveShare": 0-100 or null, "themes": [ { "theme": "...", "valence": "positive|negative|mixed|neutral", "quote": "verbatim" } ], "flags": ["anything an editor should know before tomorrow"] }
}`;

/**
 * Which rubric rows apply to this run.
 *
 * Rows scoped to another platform are not "failed", they are not asked: a
 * LinkedIn "see more" question put to an Instagram post produces a verdict
 * about nothing, and an na in every Instagram audit forever.
 */
export function criteriaFor(criteria: EvalCriterion[], platform: SocialPlatform): EvalCriterion[] {
  return criteria.filter(
    (c) => c.surface === 'social-audit' && c.isActive && (!c.platform || c.platform === platform),
  );
}

/**
 * Split the per-request image budget between our post and theirs.
 *
 * A screen recording of a competitor's grid can sample to twenty frames on its
 * own, and one side filling the budget would leave the other side invisible —
 * producing a comparison of one post against nothing, confidently written.
 * Ours gets half, the competitors share the other half, and whatever one side
 * does not use goes to the other rather than being wasted.
 *
 * Frames are dropped from the END of each set, because they are in time order
 * and the opening of a sequence is what a viewer actually sees.
 */
export function budgetImages(
  ourCount: number,
  theirCounts: number[],
  limit = MAX_IMAGES_PER_REQUEST,
): { ours: number; theirs: number[] } {
  const theirTotal = theirCounts.reduce((sum, n) => sum + n, 0);
  if (ourCount + theirTotal <= limit) return { ours: ourCount, theirs: [...theirCounts] };

  // Half each to start with.
  const half = Math.floor(limit / 2);
  let ours = Math.min(ourCount, Math.max(1, theirCounts.length ? half : limit));
  let remaining = limit - ours;

  // Round-robin rather than first-come, so three competitors do not become one
  // competitor with every frame and two with none.
  const theirs = theirCounts.map(() => 0);
  let progress = true;
  while (remaining > 0 && progress) {
    progress = false;
    for (let i = 0; i < theirCounts.length && remaining > 0; i++) {
      if (theirs[i] < theirCounts[i]) {
        theirs[i]++;
        remaining--;
        progress = true;
      }
    }
  }

  // Whatever their half did not need goes back to ours. Without this a
  // competitor who supplied two screenshots would cap the run at twelve images
  // when twenty were available and our own recording had frames to spare.
  if (remaining > 0) ours = Math.min(ourCount, ours + remaining);

  return { ours, theirs };
}

function renderSubmission(
  submission: SocialSubmission,
  heading: string,
  platform: SocialPlatform,
  imageCount: number,
  timestamps: number[],
): string {
  const frames =
    imageCount === 0
      ? '(no images for this post)'
      : timestamps.length
      ? `${imageCount} FRAME(S) attached, sampled at ${timestamps.map((t) => `${t}s`).join(', ')} of a screen recording, in that order.`
      : `${imageCount} SCREENSHOT(S) attached — read the caption and any replies from them.`;

  return [
    `=== ${heading} ===`,
    `Platform: ${platformLabel(platform)}`,
    submission.handle ? `Handle: @${submission.handle.replace(/^@/, '')}` : '',
    submission.url ? `URL: ${submission.url}` : '',
    frames,
    '',
    submission.text?.trim()
      ? `CAPTION AS PASTED:\n${submission.text.trim().slice(0, 4_000)}`
      : '(no caption was pasted — read it from the images)',
    '',
    submission.comments?.trim()
      ? `REPLIES AS PASTED:\n${submission.comments.trim().slice(0, 6_000)}`
      : '(no replies were pasted — read them from the images if any are visible)',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

function renderCriteria(criteria: EvalCriterion[]): string {
  return [
    'THE RUBRIC — grade every row against OUR post, and return its id verbatim.',
    '',
    ...criteria.map((c) =>
      [
        `id: ${c.id}`,
        `  weight: ${c.weight}`,
        `  EXPECTED verdict: ${c.expectedVerdict}${
          c.expectedVerdict === 'fail'
            ? '  ← inverted: doing the thing is the failure. Answer the question literally.'
            : ''
        }`,
        `  Q: ${c.prompt}`,
        c.guidance ? `  What counts: ${c.guidance}` : '',
        '',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n');
}

export interface SocialJudgeOutcome extends SocialJudgement {
  model: string;
}

export async function judgeSocial(input: SocialJudgeInput): Promise<SocialJudgeOutcome> {
  const { provider, platform, criteria, ours, subject } = input;
  const model = provider === 'claude' ? CLAUDE_OPUS : OPENAI_SOL;
  const warnings: string[] = [];

  if (criteria.length === 0) {
    throw new Error(
      `No active rubric rows apply to ${platformLabel(platform)}. Add one on the Human Evaluation tab, under Social Audit.`,
    );
  }

  // Oversized images are dropped before anything is sent. A provider rejecting
  // one loses the entire run, and the caller would rather lose the screenshot
  // that will not fit and grade the rest.
  const keepValid = (images: ImageInput[], who: string): ImageInput[] =>
    images.filter((image) => {
      const problems = checkImages([image]);
      if (problems.length === 0) return true;
      warnings.push(`${who}: ${problems[0]}`);
      return false;
    });

  const ourImages = keepValid(ours.images ?? [], 'Our post');
  const theirSubmissions = (input.theirs ?? []).map((submission) => ({
    submission,
    images: keepValid(submission.images ?? [], submission.label || 'A competitor post'),
  }));

  if (!ours.text?.trim() && ourImages.length === 0) {
    throw new Error(
      'Nothing to judge — attach a screenshot or a recording of our post, or paste its caption.',
    );
  }

  const budget = budgetImages(
    ourImages.length,
    theirSubmissions.map((t) => t.images.length),
  );

  if (budget.ours < ourImages.length) {
    warnings.push(
      `Our post had ${ourImages.length} frames; the first ${budget.ours} were sent so the competitor posts still fit in the same request.`,
    );
  }
  theirSubmissions.forEach((entry, i) => {
    if (budget.theirs[i] < entry.images.length) {
      warnings.push(
        `${entry.submission.label || `Competitor ${i + 1}`} had ${entry.images.length} frames; the first ${budget.theirs[i]} were sent.`,
      );
    }
  });

  // Ours first, then each competitor in turn — the same order as the prompt
  // text, so "the frames above" means what it says.
  const images: ImageInput[] = [
    ...ourImages.slice(0, budget.ours),
    ...theirSubmissions.flatMap((entry, i) => entry.images.slice(0, budget.theirs[i])),
  ];

  const prompt = [
    subject ? `SUBJECT: ${subject}\n` : '',
    renderCriteria(criteria),
    '',
    'THE FOUR DIMENSIONS — return one entry for each:',
    ...DIMENSIONS.map((d) => `  • ${d}: ${DIMENSION_BRIEFS[d]}`),
    '',
    renderSubmission(
      ours,
      'OUR POST',
      platform,
      budget.ours,
      (ours.frameTimestamps ?? []).slice(0, budget.ours),
    ),
    ...theirSubmissions.map((entry, i) =>
      renderSubmission(
        entry.submission,
        `THEIR POST ${i + 1}${entry.submission.label ? ` — ${entry.submission.label}` : ''}`,
        platform,
        budget.theirs[i],
        (entry.submission.frameTimestamps ?? []).slice(0, budget.theirs[i]),
      ),
    ),
    theirSubmissions.length > 0
      ? '\nCompare on craft only. See rule 4 — say nothing about reach, followers or engagement counts even where a screenshot shows them.'
      : '\nNo competitor post was supplied: return "differences" as an empty array. Do not compare our post against a remembered one.',
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await runAgentChat({
    system: SYSTEM,
    message: prompt,
    images: images.length ? images : undefined,
    // Each verdict costs a rationale and a quote, so the budget scales with the
    // rubric rather than being a fixed guess that truncates the JSON mid-string.
    maxTokens: Math.min(24_000, 4_000 + criteria.length * 500),
    maxRounds: 1,
    preferredProvider: provider,
    openaiModel: OPENAI_SOL,
    logTag: `probatio/social-judge:${provider}`,
  });

  const parsed = parseSocialJudgement(raw, criteria);
  return { ...parsed, model, warnings: [...warnings, ...parsed.warnings] };
}

export function parseSocialJudgement(raw: string, criteria: EvalCriterion[]): SocialJudgement {
  const result = parseAgentJson<any>(raw);

  if (!result.ok) {
    return {
      // The prose is kept rather than dropped — a failed parse still contains
      // the analysis, and an empty report would read as "no findings".
      verdict: result.raw.slice(0, 4_000),
      scores: [],
      score: null,
      differences: [],
      recommendations: [],
      sentiment: null,
      extracted: { text: '', comments: '', handle: null },
      parseError: result.error,
      warnings: [],
    };
  }

  const d = result.data;
  const validIds = new Set(criteria.map((c) => c.id));
  const warnings: string[] = [];

  const scores = arrayOf<CriterionScore>(d?.scores, (s) => {
    const criterionId = str(s?.criterionId, 80);
    // A verdict against an id we did not send is discarded rather than stored:
    // it would render as a row nobody can trace back to a criterion.
    if (!criterionId || !validIds.has(criterionId)) return null;
    return {
      criterionId,
      verdict: oneOf(s?.verdict, ['pass', 'fail', 'na'] as const, 'na'),
      rationale: str(s?.rationale, 1_200),
      evidence: str(s?.evidence, 800),
    };
  });

  // Dedupe, last write wins. A repeated criterion would be double-counted by
  // the weighted score, and eval_results is keyed on (run, criterion, judge) —
  // Postgres rejects an upsert batch that touches the same row twice.
  const byCriterion = new Map(scores.map((s) => [s.criterionId, s]));
  const deduped = [...byCriterion.values()];

  const missing = criteria.filter((c) => !byCriterion.has(c.id)).length;
  if (missing > 0) {
    warnings.push(
      `${missing} of ${criteria.length} criteria were not returned by the judge and are unscored. The score below is computed from the rest.`,
    );
  }

  // A verdict with no evidence is an opinion. Rule 1 says to abstain in that
  // case, so one that arrives anyway is downgraded rather than trusted.
  let unevidenced = 0;
  for (const score of deduped) {
    if (score.verdict !== 'na' && !score.evidence) {
      score.verdict = 'na';
      score.rationale =
        `${score.rationale} (Downgraded to N/A: the judge returned a verdict with no quoted evidence.)`.trim();
      unevidenced++;
    }
  }
  if (unevidenced > 0) {
    warnings.push(
      `${unevidenced} verdict(s) arrived without a supporting quote and were downgraded to N/A rather than counted.`,
    );
  }

  // One entry per dimension, last write wins. Two readings of "tone" is the
  // judge restating itself, and rendering both invites the reader to average
  // them.
  const differenceRows = arrayOf<DifferenceRead>(d?.differences, (row) => {
    const difference = str(row?.difference, 1_200);
    if (!difference) return null;
    const dimension = String(row?.dimension ?? '').toLowerCase();
    if (!DIMENSIONS.includes(dimension as Dimension)) return null;
    return {
      dimension: dimension as Dimension,
      ours: str(row?.ours, 1_000),
      theirs: str(row?.theirs, 1_000),
      difference,
      evidence: str(row?.evidence, 800),
      advantage: oneOf(row?.advantage, ['ours', 'theirs', 'neither'] as const, 'neither'),
    };
  });
  const byDimension = new Map(differenceRows.map((row) => [row.dimension, row]));
  // Kept in the canonical order rather than the order the model happened to
  // emit, so two runs of the same audit read the same way.
  const differences = DIMENSIONS.map((dim) => byDimension.get(dim)).filter(
    (row): row is DifferenceRead => row !== undefined,
  );

  const sentimentRaw = d?.sentiment;

  return {
    verdict: str(d?.verdict, 4_000),
    scores: deduped,
    score: weightedScore(deduped, criteria),
    differences,
    recommendations: arrayOf<Recommendation>(d?.recommendations, (r) => {
      const change = str(r?.change, 800);
      if (!change) return null;
      return {
        priority: oneOf(r?.priority, ['high', 'medium', 'low'] as const, 'medium'),
        change,
        rationale: str(r?.rationale, 800),
        effort: oneOf(r?.effort, ['rewrite', 'new-asset', 'new-reporting'] as const, 'rewrite'),
      };
    }),
    sentiment: sentimentRaw
      ? {
          summary: str(sentimentRaw?.summary, 2_000),
          positiveShare: numberInRange(sentimentRaw?.positiveShare, 0, 100),
          themes: arrayOf<SentimentRead['themes'][number]>(sentimentRaw?.themes, (t) => {
            const theme = str(t?.theme, 400);
            if (!theme) return null;
            return {
              theme,
              valence: oneOf(
                t?.valence,
                ['positive', 'negative', 'mixed', 'neutral'] as const,
                'neutral',
              ),
              quote: str(t?.quote, 600),
            };
          }),
          flags: arrayOf<string>(sentimentRaw?.flags, (f) => str(f, 500) || null),
        }
      : null,
    extracted: {
      text: str(d?.extracted?.text, 6_000),
      comments: str(d?.extracted?.comments, 8_000),
      handle: str(d?.extracted?.handle, 80) || null,
    },
    parseError: null,
    warnings,
  };
}

/** Flatten a judgement into the summary stored on the run. */
export function renderSocialSummary(
  judgement: SocialJudgement,
  criteria: EvalCriterion[],
): string {
  const byId = new Map(criteria.map((c) => [c.id, c]));
  const lines: string[] = [];

  if (judgement.score !== null) lines.push(`SCORE: ${judgement.score}/100 (weighted)`, '');
  if (judgement.verdict) lines.push(judgement.verdict, '');

  const failed = judgement.scores.filter((s) => {
    const criterion = byId.get(s.criterionId);
    return criterion && s.verdict !== 'na' && s.verdict !== criterion.expectedVerdict;
  });

  if (failed.length) {
    lines.push('FELL SHORT ON:');
    for (const score of failed) {
      lines.push(`  • ${byId.get(score.criterionId)?.prompt ?? score.criterionId}`);
      if (score.evidence) lines.push(`      "${score.evidence}"`);
      if (score.rationale) lines.push(`      ${score.rationale}`);
    }
    lines.push('');
  }

  if (judgement.differences.length) {
    lines.push('AGAINST THEIRS:');
    for (const row of judgement.differences) {
      lines.push(`  ${row.dimension.toUpperCase()} — advantage: ${row.advantage}`);
      lines.push(`      ${row.difference}`);
      if (row.evidence) lines.push(`      theirs: "${row.evidence}"`);
    }
    lines.push('');
  }

  if (judgement.recommendations.length) {
    lines.push('CHANGE THIS:');
    for (const rec of judgement.recommendations) {
      lines.push(`  [${rec.priority.toUpperCase()} · ${rec.effort}] ${rec.change}`);
      if (rec.rationale) lines.push(`      ${rec.rationale}`);
    }
    lines.push('');
  }

  if (judgement.sentiment) {
    lines.push('WHAT THE REPLIES SAID:', judgement.sentiment.summary);
    for (const flag of judgement.sentiment.flags) lines.push(`  ⚠ ${flag}`);
  }

  return lines.join('\n').trim();
}
