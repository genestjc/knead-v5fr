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

export interface SocialJudgeInput {
  provider: EvalProvider;
  platform: SocialPlatform;
  criteria: EvalCriterion[];
  ours: SocialSubmission;
  theirs?: SocialSubmission[];
  /** What the post is about, when naming it helps. */
  subject?: string | null;
}

const SYSTEM = `You are the editorial judge for Knead, an independent magazine covering art, music, food, technology, creative culture and independent journalism. You grade social posts against a fixed rubric, and you compare them against each other.

Your inputs are PICTURES: screenshots, or frames sampled out of a screen recording. Read the captions and any visible replies out of the images — that is what they are for. Also read what the images SHOW, because on a visual platform the photograph is half the post and several criteria turn on it. Where frames carry timestamps, they are in order: treat them as one sequence, not as separate posts.

YOU ARE DOING TWO JOBS, AND BOTH ARE REQUIRED.

FIRST, grade EVERY post you are given against the full rubric, separately — ours and each competitor's. Each post carries a POST ID; return one entry per post using that id verbatim. Grade each on its own evidence: a verdict about our post may never rest on something only visible in theirs.

Scoring a competitor against our rubric does not mean judging whether their post is good in the abstract. The rubric encodes what WE are trying to do. A competitor's score answers "how much of what we are trying to do does their post already achieve" — which is worth knowing precisely because it is our standard, not theirs. Grade it literally and let the number mean what it means.

SECOND, compare them: the four dimensions, and an overall head-to-head naming which post is strongest and why.

HOW TO GRADE

For every criterion, on every post, return exactly one verdict:
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
  "posts": [
    {
      "postId": "the POST ID given, verbatim",
      "extracted": { "text": "that post's caption as you read it", "comments": "its replies as you read them, or empty", "handle": "its account handle if visible, else null" },
      "verdict": "3-5 sentences on THIS post: what it does, what it does not, and the one change that would matter most.",
      "scores": [ { "criterionId": "the id given", "verdict": "pass|fail|na", "rationale": "one or two sentences", "evidence": "verbatim quote, or a literal description for image criteria" } ]
    }
  ],
  "differences": [ { "dimension": "style|tone|content|delivery", "ours": "what ours does", "theirs": "what theirs does", "difference": "the difference that matters and what follows from it", "evidence": "verbatim quote or literal description from THEIR post", "advantage": "ours|theirs|neither" } ],
  "comparison": null or { "leaderId": "the POST ID of the strongest post, or null if you genuinely cannot separate them", "summary": "3-5 sentences: which post is strongest, on what, and what separates the field.", "toClose": ["what ours would have to do to close the gap — empty if ours leads"] },
  "recommendations": [ { "priority": "high|medium|low", "change": "the specific edit to OUR post", "rationale": "why it matters", "effort": "rewrite|new-asset|new-reporting" } ],
  "sentiment": null or { "summary": "...", "positiveShare": 0-100 or null, "themes": [ { "theme": "...", "valence": "positive|negative|mixed|neutral", "quote": "verbatim" } ], "flags": ["anything an editor should know before tomorrow"] }
}

One "posts" entry per post you were given — every one, including ours. "sentiment" and "recommendations" are about OUR post only.`;

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
  postId: string,
  heading: string,
  platform: SocialPlatform,
  imageCount: number,
  timestamps: number[],
): string {
  const frames =
    imageCount === 0
      ? '(no images for this post)'
      : describeImages(imageCount, timestamps);

  return [
    `=== ${heading} ===`,
    // The id the judge must echo back on this post's scores. Stated first and
    // on its own line so it cannot be confused with the account name.
    `POST ID: ${postId}`,
    `Account: ${submission.label}${
      submission.handle ? ` (@${submission.handle.replace(/^@/, '')})` : ''
    }`,
    `Platform: ${platformLabel(platform)}`,
    submission.url ? `Link to the post: ${submission.url}` : '',
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
    // Supplied by a person, and marked as such. It is context, not evidence: a
    // note saying "this one did well" is not a quote and must never end up in
    // an evidence field.
    submission.notes?.trim()
      ? `WHAT WE WERE TOLD ABOUT THIS POST (context from an editor, not evidence — never quote this as though it came from the post):\n${submission.notes
          .trim()
          .slice(0, 2_000)}\n`
      : '',
    renderStory(submission),
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * The article the post points at.
 *
 * Three states, and they are not interchangeable. Fetched: the judge can check
 * the caption against it. Not supplied: say so, so the accuracy rows come back
 * N/A for the honest reason rather than being guessed at. Supplied but
 * unreachable: say THAT, because a paywall or a bot block is a different fact
 * from nobody having pasted a link, and the person can act on it.
 */
function renderStory(submission: SocialSubmission): string {
  if (submission.story?.text) {
    return [
      `THE STORY THIS POST POINTS AT — ${submission.story.url}`,
      submission.story.title ? `Headline: ${submission.story.title}` : '',
      'Use this to check whether the post overstates, sharpens a hedge into a certainty, or claims',
      'something the piece does not support. Judge the POST against it — the article itself is not',
      'under review here.',
      '',
      submission.story.text.slice(0, 12_000),
    ]
      .filter(Boolean)
      .join('\n');
  }

  const why = submission.storyUrl
    ? `THE STORY THIS POST POINTS AT: ${submission.storyUrl} — supplied, but it could not be fetched, so its text is not available here.`
    : '(no story link was supplied for this post)';

  // Matches the rubric row's own guidance: without the piece, the accuracy
  // check is partial rather than impossible — a post can still make a claim it
  // does not itself evidence.
  return `${why} Judge only whether the post makes claims it does not itself evidence, say the check was partial, and do not assert anything about what the article does or does not say.`;
}

/**
 * What was attached, told apart.
 *
 * A submission can carry both — someone films the Story sequence and also
 * screenshots the comment thread — and the frames always come first, in time
 * order. Describing all of them as frames would tell the model that a
 * screenshot of the replies is the end of the sequence, which is the one thing
 * about the ordering it actually needs to get right.
 */
export function describeImages(imageCount: number, timestamps: number[]): string {
  const frames = Math.min(timestamps.length, imageCount);
  const stills = imageCount - frames;

  const parts: string[] = [];
  if (frames > 0) {
    parts.push(
      `The first ${frames} image(s) are FRAMES from a screen recording, sampled at ` +
        `${timestamps.slice(0, frames).map((t) => `${t}s`).join(', ')}, in that order — read them as one sequence.`,
    );
  }
  if (stills > 0) {
    parts.push(
      `${frames > 0 ? `The remaining ${stills}` : `${stills}`} image(s) are SCREENSHOT(S) — separate captures, not part of any sequence.`,
    );
  }
  parts.push('Read the caption and any visible replies out of them.');
  return parts.join(' ');
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

  // Ids are assigned here, not by the model, so a judge that invents or
  // reorders them can be caught at parse time rather than silently attaching
  // our competitor's verdicts to our own post.
  const roster: { id: string; label: string; isOurs: boolean }[] = [
    { id: OUR_POST_ID, label: ours.label, isOurs: true },
    ...theirSubmissions.map((entry, i) => ({
      id: theirPostId(i),
      label: entry.submission.label || `Competitor ${i + 1}`,
      isOurs: false,
    })),
  ];

  const prompt = [
    subject ? `SUBJECT: ${subject}\n` : '',
    renderCriteria(criteria),
    '',
    'THE FOUR DIMENSIONS — return one entry for each:',
    ...DIMENSIONS.map((d) => `  • ${d}: ${DIMENSION_BRIEFS[d]}`),
    '',
    `THE POSTS — grade every one of these against the full rubric, separately, and return one "posts" entry per id:`,
    ...roster.map((p) => `  • ${p.id} — ${p.label}${p.isOurs ? ' (OURS)' : ''}`),
    '',
    renderSubmission(
      ours,
      OUR_POST_ID,
      'OUR POST',
      platform,
      budget.ours,
      (ours.frameTimestamps ?? []).slice(0, budget.ours),
    ),
    ...theirSubmissions.map((entry, i) =>
      renderSubmission(
        entry.submission,
        theirPostId(i),
        `THEIR POST ${i + 1}${entry.submission.label ? ` — ${entry.submission.label}` : ''}`,
        platform,
        budget.theirs[i],
        (entry.submission.frameTimestamps ?? []).slice(0, budget.theirs[i]),
      ),
    ),
    theirSubmissions.length > 0
      ? '\nCompare on craft only. See rule 4 — say nothing about reach, followers or engagement counts even where a screenshot shows them.'
      : `\nOnly our post was submitted: return "differences" as an empty array and "comparison" as null. Do not compare our post against a remembered one.`,
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

  const parsed = parseSocialJudgement(raw, criteria, roster);
  return { ...parsed, model, warnings: [...warnings, ...parsed.warnings] };
}

export interface PostRoster {
  id: string;
  label: string;
  isOurs: boolean;
}

export function parseSocialJudgement(
  raw: string,
  criteria: EvalCriterion[],
  roster: PostRoster[],
): SocialJudgement {
  const result = parseAgentJson<any>(raw);

  const blank = (entry: PostRoster, verdict = ''): PostJudgement => ({
    postId: entry.id,
    label: entry.label,
    isOurs: entry.isOurs,
    scores: [],
    score: null,
    verdict,
    extracted: { text: '', comments: '', handle: null },
  });

  if (!result.ok) {
    return {
      // The prose is kept rather than dropped — a failed parse still contains
      // the analysis, and an empty report would read as "no findings". It is
      // attached to our post, which is the one anybody is reading for.
      posts: roster.map((entry) =>
        entry.isOurs ? blank(entry, result.raw.slice(0, 4_000)) : blank(entry),
      ),
      differences: [],
      comparison: null,
      recommendations: [],
      sentiment: null,
      parseError: result.error,
      warnings: [],
    };
  }

  const d = result.data;
  const validCriteria = new Set(criteria.map((c) => c.id));
  const validPosts = new Set(roster.map((r) => r.id));
  const warnings: string[] = [];

  // ── one judgement per post ────────────────────────────────────────────────
  //
  // Keyed on the id WE assigned. A block against an id nobody sent is dropped
  // rather than guessed at: attaching a competitor's verdicts to our post would
  // be invisible in the UI and wrong in eval_results.
  const byPost = new Map<string, any>();
  let unknownPosts = 0;
  for (const block of Array.isArray(d?.posts) ? d.posts : []) {
    const postId = str(block?.postId, 40);
    if (!postId || !validPosts.has(postId)) {
      unknownPosts++;
      continue;
    }
    byPost.set(postId, block);
  }
  if (unknownPosts > 0) {
    warnings.push(
      `${unknownPosts} block(s) of scores came back against a post id that was never sent, and were discarded.`,
    );
  }

  const posts: PostJudgement[] = roster.map((entry) => {
    const block = byPost.get(entry.id);
    if (!block) {
      warnings.push(`${entry.label} was not graded by the judge — it returned no scores for it.`);
      return blank(entry);
    }

    const scores = arrayOf<CriterionScore>(block?.scores, (row) => {
      const criterionId = str(row?.criterionId, 80);
      // A verdict against an id we did not send is discarded rather than
      // stored: it would render as a row nobody can trace back to a criterion.
      if (!criterionId || !validCriteria.has(criterionId)) return null;
      return {
        criterionId,
        verdict: oneOf(row?.verdict, ['pass', 'fail', 'na'] as const, 'na'),
        rationale: str(row?.rationale, 1_200),
        evidence: str(row?.evidence, 800),
      };
    });

    // Dedupe, last write wins. A repeated criterion would be double-counted by
    // the weighted score, and eval_results is keyed on (run, criterion, judge)
    // — Postgres rejects an upsert batch that touches the same row twice.
    const byCriterion = new Map(scores.map((row) => [row.criterionId, row]));
    const deduped = [...byCriterion.values()];

    const missing = criteria.filter((c) => !byCriterion.has(c.id)).length;
    if (missing > 0) {
      warnings.push(
        `${entry.label}: ${missing} of ${criteria.length} criteria were not returned and are unscored. Its score is computed from the rest.`,
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
        `${entry.label}: ${unevidenced} verdict(s) arrived without a supporting quote and were downgraded to N/A rather than counted.`,
      );
    }

    return {
      postId: entry.id,
      label: entry.label,
      isOurs: entry.isOurs,
      scores: deduped,
      score: weightedScore(deduped, criteria),
      verdict: str(block?.verdict, 4_000),
      extracted: {
        text: str(block?.extracted?.text, 6_000),
        comments: str(block?.extracted?.comments, 8_000),
        handle: str(block?.extracted?.handle, 80) || null,
      },
    };
  });

  // ── the four dimensions ───────────────────────────────────────────────────
  //
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

  // ── the head-to-head ──────────────────────────────────────────────────────
  const comparisonRaw = d?.comparison;
  const leaderId = str(comparisonRaw?.leaderId, 40);
  const comparison: ComparisonRead | null =
    comparisonRaw && roster.length > 1
      ? {
          // A leader naming a post nobody sent is dropped to null rather than
          // rendered as a winner that does not exist.
          leaderId: leaderId && validPosts.has(leaderId) ? leaderId : null,
          summary: str(comparisonRaw?.summary, 3_000),
          toClose: arrayOf<string>(comparisonRaw?.toClose, (t) => str(t, 600) || null),
        }
      : null;

  const sentimentRaw = d?.sentiment;

  return {
    posts,
    differences,
    comparison,
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
    parseError: null,
    warnings,
  };
}

/**
 * Flatten a judgement into the summary stored on the run.
 *
 * Leads with the scoreboard, because the first question anyone opening an old
 * audit asks is who came out ahead. Ours is detailed row by row; competitors
 * get their score and their verdict, since nobody is going to hand-grade a
 * competitor's post against our rubric line by line.
 */
export function renderSocialSummary(
  judgement: SocialJudgement,
  criteria: EvalCriterion[],
): string {
  const byId = new Map(criteria.map((c) => [c.id, c]));
  const lines: string[] = [];
  const ours = oursOf(judgement);

  // ── the scoreboard ────────────────────────────────────────────────────────
  if (judgement.posts.length > 1) {
    lines.push('SCOREBOARD — against Knead\'s rubric, so a competitor\'s number is');
    lines.push('"how much of what we are trying to do does their post already achieve".');
    lines.push('');
    const ranked = [...judgement.posts].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    for (const post of ranked) {
      const score = post.score === null ? ' —' : String(post.score).padStart(3);
      lines.push(`  ${score}  ${post.label}${post.isOurs ? '  ← OURS' : ''}`);
    }
    lines.push('');
  } else if (ours?.score !== null && ours?.score !== undefined) {
    lines.push(`SCORE: ${ours.score}/100 (weighted)`, '');
  }

  if (judgement.comparison) {
    const leader = judgement.posts.find((p) => p.postId === judgement.comparison!.leaderId);
    if (leader) lines.push(`STRONGEST: ${leader.label}${leader.isOurs ? ' (ours)' : ''}`);
    if (judgement.comparison.summary) lines.push(judgement.comparison.summary);
    if (judgement.comparison.toClose.length) {
      lines.push('', 'TO CLOSE THE GAP:');
      for (const step of judgement.comparison.toClose) lines.push(`  • ${step}`);
    }
    lines.push('');
  }

  // ── our post, in detail ───────────────────────────────────────────────────
  if (ours?.verdict) lines.push('OUR POST:', ours.verdict, '');

  const failed = (ours?.scores ?? []).filter((s) => {
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

  // ── their posts, briefly ──────────────────────────────────────────────────
  for (const post of judgement.posts.filter((p) => !p.isOurs)) {
    if (!post.verdict && post.score === null) continue;
    lines.push(`${post.label.toUpperCase()}${post.score === null ? '' : ` — ${post.score}/100`}:`);
    if (post.verdict) lines.push(post.verdict);
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
