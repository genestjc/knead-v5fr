/**
 * The social judge — LLM-as-judge for a post, graded against the rubric.
 *
 * Reads a caption, a screenshot, or both, and returns a verdict per criterion
 * with the quote that decides it, plus edits you could make this afternoon.
 * Where a competitor's post is supplied it grades that too and says what
 * theirs did that ours didn't.
 *
 * WHY SCREENSHOTS ARE THE PRIMARY INPUT, not a fallback. Instagram and X have
 * no unauthenticated read path, so a pasted link gets a login page, and the
 * APIs want credentials that expire or cost money. A screenshot needs none of
 * that — and it carries MORE than the API would, because it contains the
 * photograph, and on Instagram the photograph is half of why a post works. The
 * Graph API would hand us `caption` and `like_count` and nothing about whether
 * the picture was any good.
 *
 * THE RULES IN THE PROMPT each exist because of a specific way an LLM judge
 * goes wrong on this material: agreeing with whatever it is shown, inventing a
 * quote to justify a verdict it already picked, scoring a criterion the post
 * gave it no way to answer, and turning "this could be better" into a
 * recommendation nobody can act on.
 */
import { runAgentChat, checkImages, CLAUDE_OPUS, OPENAI_SOL, type ImageInput } from '@/lib/ai/router';
import { platformLabel, type SocialPlatform } from '../types';
import type {
  ComparisonRead,
  CriterionScore,
  JudgeCriterion,
  JudgedPost,
  Recommendation,
  SentimentRead,
} from './types';
import { parseJudgement } from './parse';

export interface JudgeInput {
  provider: 'claude' | 'openai';
  platform: SocialPlatform;
  criteria: JudgeCriterion[];
  /** Ours. Caption and/or screenshot. */
  ours: JudgedPost;
  images?: ImageInput[];
  /** Optional competitor posts on the same subject, for the comparison pass. */
  theirs?: { post: JudgedPost; images?: ImageInput[] }[];
  /** What the post is about, when it helps. Optional. */
  subject?: string | null;
}

export interface JudgeOutput {
  scores: CriterionScore[];
  score: number | null;
  verdict: string;
  recommendations: Recommendation[];
  sentiment: SentimentRead | null;
  comparison: ComparisonRead | null;
  /** Caption and comments as the model read them — from the image, where relevant. */
  extracted: { text: string; comments: string; handle: string | null };
  model: string;
  parseError: string | null;
  /** Non-fatal problems: an image too large, a competitor post that was skipped. */
  warnings: string[];
}

const SYSTEM = `You are the editorial judge for Knead, an independent magazine covering art, music, food, technology, creative culture and independent journalism. You grade social posts against a fixed rubric.

You may be given the post as TEXT, as a SCREENSHOT, or both. When you are given a screenshot, read the caption and any visible replies out of the image — that is what the image is for. Also read what the image SHOWS, because on a visual platform the photograph is half the post and several criteria turn on it.

HOW TO GRADE

For every criterion you are given, return exactly one verdict:
- "pass" — the post does the thing the criterion describes.
- "fail" — it does not.
- "na" — THE POST GAVE YOU NO WAY TO JUDGE IT. Use this and mean it. A criterion about the image on a caption-only submission is "na". A criterion about factual accuracy when the underlying story was not supplied is "na". Guessing here is worse than abstaining, because an invented verdict is indistinguishable from a real one once it is in the table.

Note each criterion's EXPECTED verdict. A few are written so that doing the thing is the failure — "does the caption use engagement bait?" expects "fail". Answer the question as literally asked; the scoring handles the polarity. Do not invert your answer to be helpful.

RULES YOU DO NOT BREAK

1. QUOTE OR ABSTAIN. Every pass and every fail carries a verbatim quote from the post that decides it. If you cannot quote it, the verdict is "na". Never paraphrase into the evidence field, never assemble a quote from scattered words, and never write a quote that is not in the material you were given. For a criterion about the image, the "quote" is a short literal description of what is visible.

2. GRADE THE POST, NOT THE SUBJECT. A dull post about a fascinating show is a dull post. A sharp post about a minor opening is a sharp post. You are judging the writing and the asset.

3. DO NOT AGREE BY DEFAULT. Passing everything is the failure mode of this task. If a post is mediocre, most criteria should fail, and saying so plainly is the entire value you add. A rubric that always returns 90 tells nobody anything.

4. RECOMMENDATIONS ARE EDITS SOMEBODY COULD MAKE THIS AFTERNOON. "Improve the hook" is useless. "Open on the 1998 closure date instead of 'We sat down with' — it is the only fact here a stranger would stop for" is useful. Mark each one's effort honestly: "rewrite" if the caption alone changes, "new-asset" if it needs a different image or video, "new-reporting" if it needs a fact we do not have. Do not label something a rewrite when it needs a photograph we never took.

5. IF IT IS GOOD, SAY SO. Do not manufacture faults. A post that passes on merit should be told what carried it, so it can be repeated.

6. COMMENTS: READ WHAT THEY MEAN. Sarcasm is not praise — "oh great, another think piece" is negative. "This is devastating" about a closure is praise. If fewer than about 15 comments were supplied, set positiveShare to null and say the sample is too thin to characterise; a handful of replies is a handful of people, not an audience.

7. COMPARISON IS ABOUT CRAFT, NOT REACH. Where competitor posts are supplied, compare what the posts DO — what they lead with, what they quote, what they show. Say nothing about follower counts, likes or who "won" on engagement, even if those numbers are visible in a screenshot. Our following is small; a reach comparison would measure that and nothing else.

Return strict JSON only, no markdown fences, in exactly this shape:
{
  "extracted": { "text": "the caption as you read it", "comments": "replies as you read them, or empty", "handle": "the account handle if visible, else null" },
  "verdict": "3-5 sentences: what this post does, what it does not, and the one change that would matter most.",
  "scores": [ { "criterionId": "the id given", "verdict": "pass|fail|na", "rationale": "one or two sentences", "evidence": "verbatim quote, or a literal description for image criteria" } ],
  "recommendations": [ { "priority": "high|medium|low", "change": "the specific edit", "rationale": "why it matters", "effort": "rewrite|new-asset|new-reporting" } ],
  "sentiment": null or { "summary": "...", "positiveShare": 0-100 or null, "themes": [ { "theme": "...", "valence": "positive|negative|mixed|neutral", "quote": "verbatim" } ], "flags": ["anything an editor should know before tomorrow"] },
  "comparison": null or { "verdict": "...", "advantages": [ { "handle": "@theirs", "advantage": "what they did that we did not", "evidence": "verbatim quote from their post" } ], "oursStronger": ["where ours genuinely wins"] }
}`;

function renderPost(post: JudgedPost, label: string, hasImages: boolean): string {
  return [
    `=== ${label} ===`,
    `Platform: ${platformLabel(post.platform)}`,
    post.handle ? `Handle: @${post.handle}` : '',
    post.url ? `URL: ${post.url}` : '',
    hasImages ? 'A SCREENSHOT of this post is attached — read the caption and replies from it.' : '',
    '',
    post.text ? `CAPTION AS PASTED:\n${post.text.slice(0, 4_000)}` : '(no caption was pasted)',
    '',
    post.comments
      ? `REPLIES AS PASTED:\n${post.comments.slice(0, 6_000)}`
      : '(no replies were pasted — if the screenshot shows some, read them from it; if not, return sentiment as null)',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

function renderCriteria(criteria: JudgeCriterion[]): string {
  return [
    'THE RUBRIC — grade every row, return its id verbatim.',
    '',
    ...criteria.map((c) =>
      [
        `id: ${c.id}`,
        `  weight: ${c.weight}`,
        `  EXPECTED verdict: ${c.expectedVerdict}${c.expectedVerdict === 'fail' ? '  ← inverted: doing the thing is the failure. Answer the question literally.' : ''}`,
        `  Q: ${c.prompt}`,
        `  What counts: ${c.guidance}`,
        '',
      ].join('\n'),
    ),
  ].join('\n');
}

export async function judgePost(input: JudgeInput): Promise<JudgeOutput> {
  const { provider, criteria, ours, subject } = input;
  const model = provider === 'claude' ? CLAUDE_OPUS : OPENAI_SOL;
  const warnings: string[] = [];

  // Images are validated before anything is sent: a provider rejecting an
  // oversized one loses the whole run, and the caller would rather drop the
  // bad screenshot and grade the rest.
  const ourImages = (input.images ?? []).slice();
  const imageProblems = checkImages(ourImages);
  if (imageProblems.length) {
    warnings.push(...imageProblems);
    // Keep only what fits, rather than failing outright.
    for (let i = ourImages.length - 1; i >= 0; i--) {
      if (checkImages([ourImages[i]]).length) ourImages.splice(i, 1);
    }
  }

  const theirImages: ImageInput[] = [];
  for (const competitor of input.theirs ?? []) {
    for (const image of competitor.images ?? []) {
      if (checkImages([image]).length === 0) theirImages.push(image);
      else warnings.push(`A screenshot for @${competitor.post.handle ?? 'competitor'} was too large and was skipped.`);
    }
  }

  const allImages = [...ourImages, ...theirImages];

  if (!ours.text.trim() && allImages.length === 0) {
    throw new Error(
      'Nothing to judge — paste the caption or attach a screenshot. The judge reads one or the other.',
    );
  }

  const prompt = [
    subject ? `SUBJECT: ${subject}\n` : '',
    renderCriteria(criteria),
    '',
    renderPost(ours, 'OUR POST', ourImages.length > 0),
    ...(input.theirs ?? []).map((c, i) =>
      renderPost(c.post, `COMPETITOR POST ${i + 1}`, (c.images ?? []).length > 0),
    ),
    (input.theirs ?? []).length > 0
      ? '\nCompare on craft only. See rule 7 — say nothing about reach, followers or engagement counts even if a screenshot shows them.'
      : '\nNo competitor post was supplied: return "comparison" as null.',
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await runAgentChat({
    system: SYSTEM,
    message: prompt,
    images: allImages.length ? allImages : undefined,
    // Each verdict carries a rationale and a quote, so the budget scales with
    // the rubric rather than being fixed.
    maxTokens: Math.min(16_000, 2_500 + criteria.length * 400),
    maxRounds: 1,
    preferredProvider: provider,
    openaiModel: OPENAI_SOL,
    logTag: `social54/judge:${provider}`,
  });

  const parsed = parseJudgement(raw, criteria);
  return { ...parsed, model, warnings: [...warnings, ...parsed.warnings] };
}


export { parseJudgement, renderJudgementSummary } from './parse';
