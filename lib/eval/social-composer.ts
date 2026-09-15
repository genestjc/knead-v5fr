/**
 * The composer — the next post, written from what the audit just found.
 *
 * It sits underneath the judge on the Social Audit tab, and that position is
 * the design. A generic "write me a social post" agent produces copy that could
 * be about anything, which is why most of them get used once. This one is
 * constrained three ways, and the constraints are the product:
 *
 *   1. It writes about a REAL STORY, pulled from Sanity — headline, standfirst,
 *      and the opening of the piece. Nothing it claims may come from anywhere
 *      else, because a social post that overstates what the article says is a
 *      correction waiting to happen. The story is looked up server-side by
 *      slug, never accepted as text from the client, or the rule would be
 *      worth nothing.
 *
 *   2. It is shown THE AUDIT — the rubric rows our last post fell short on,
 *      what the competitor did differently, and the edits the judge asked for.
 *      This is what replaces the engagement numbers an account with real reach
 *      would use as evidence: at our size the numbers say nothing, and "they
 *      opened on the closure date and we opened on our own byline" says a
 *      great deal. A draft that does not act on the audit is a draft that
 *      wasted the audit.
 *
 *   3. It writes PER PLATFORM, because the single most common failure in
 *      social drafting is one caption reformatted five times. A cast is not a
 *      caption is not a LinkedIn post.
 *
 * It returns drafts ready to post, each with the reason it is shaped that way,
 * so an editor can disagree with the reasoning rather than just the words.
 */
import { runAgentChat, CLAUDE_OPUS, OPENAI_SOL } from '@/lib/ai/router';
import { SITE_TOPICS } from '@/lib/constants';
import { arrayOf, oneOf, parseAgentJson, str } from './json';
import {
  platformLabel,
  SOCIAL_PLATFORMS,
  type EvalProvider,
  type SocialPlatform,
} from './types';
import type { DifferenceRead, Recommendation } from './social-judge';

export interface StoryBrief {
  title: string;
  slug: string;
  excerpt: string | null;
  /** The opening of the piece — enough to write from without inventing. */
  opening: string | null;
  url: string;
  author: string | null;
  publishedAt: string | null;
}

export interface Draft {
  platform: SocialPlatform;
  /** The post, ready to publish. */
  body: string;
  /** What to attach — an image, the cover, a video, nothing. */
  asset: string;
  rationale: string;
  /**
   * 'grounded' when the shape came from the audit, 'inferred' when it rests on
   * platform convention. Marked so a hunch is never read as a finding.
   */
  confidence: 'grounded' | 'inferred';
  /** Hashtags kept separate so they can be dropped without editing the body. */
  tags: string[];
}

export interface ComposerResult {
  storyTitle: string;
  /** The single line an editor should lead the campaign with. */
  angle: string;
  drafts: Draft[];
  /** Claims the agent deliberately avoided because the story doesn't support them. */
  avoided: string[];
  model: string;
  parseError: string | null;
}

/** The audit's findings, as evidence the composer writes against. */
export interface AuditEvidence {
  platform: SocialPlatform;
  score: number | null;
  verdict: string;
  /** The rubric rows our post fell short on, in the rubric's own words. */
  shortfalls: { prompt: string; rationale: string; evidence: string }[];
  differences: DifferenceRead[];
  recommendations: Recommendation[];
}

/**
 * What each platform actually rewards, in Knead's mix.
 *
 * Written as editorial guidance rather than as rules a model can recite: the
 * point is to stop one caption being reformatted five times.
 */
const PLATFORM_BRIEFS: Record<SocialPlatform, string> = {
  instagram:
    'Instagram: the image does the work and the caption earns the save. Open on the most specific concrete detail in the story — a date, a name, a number, a thing someone said — never on "Our new piece explores…". Reach here is saves-driven, so the caption should be worth keeping: a fact someone would screenshot. 2–5 short paragraphs. Link goes in bio, so the caption must stand alone. Hashtags are functional here, 5–10, specific over broad.',
  x: 'X: the first line is the entire post as far as the timeline is concerned. State the finding, not the fact that we published something. No "🧵" theatre unless there is a real thread. Quote-posts and replies are where reach comes from, so give people something to argue with or add to. Link at the end. One or two hashtags at most — more reads as marketing.',
  farcaster:
    'Farcaster: a small, technical, onchain-native readership that dislikes being marketed to. Write as a person, not a brand — first person is fine. The channel rewards a genuine opinion or an unexpected detail over a headline restatement. Embeds render, so the link belongs in the cast. Under 320 characters. Hashtags are close to meaningless here; skip them.',
  zora: 'Zora: the post IS the collectible, so the text is a caption for something being minted, not an announcement about an article. Say what the piece is and why it is worth holding. Collecting costs money, so the ask has to be honest about what someone gets. No hashtags.',
  linkedin:
    'LinkedIn: press, partnerships, the trade. The story is the evidence, the post is the argument about the industry it sits in. Longer is fine — 3–6 short paragraphs — but the first two lines are what gets seen before "see more". No hashtag walls; two or three at most. Never write in the LinkedIn register of rhetorical questions and one-line paragraphs.',
};

const SYSTEM = `You write social posts for Knead, an independent magazine covering ${SITE_TOPICS.join(', ')}.

You are given one real story — headline, standfirst, opening — and, where one exists, the AUDIT of a post we already published: the rubric rows it fell short on, what a competitor's post on a similar subject did differently, and the edits an editorial judge asked for. You write a draft per platform.

RULES YOU DO NOT BREAK:

1. ONLY WHAT THE STORY SAYS. Every factual claim in every draft must be supported by the story text you were given. If the story does not name the date, you do not name the date. If you want to say something the story does not support, put it in "avoided" instead and say why. An overstated social post is a correction the magazine has to publish.

2. ACT ON THE AUDIT. Where an audit is supplied, every one of its high-priority recommendations must be visibly answered by at least one draft, and the rubric rows we failed must not be failed again. Name the finding you acted on in the rationale and set confidence to "grounded". Where there is no audit for a platform, set "inferred" and say the choice rests on platform convention rather than on evidence. Never present a hunch as a finding.

3. NO TWO DRAFTS ARE THE SAME POST. Each platform brief says what that platform rewards. A caption reformatted five times is the failure mode here. If two drafts could swap platforms without anyone noticing, you have not done the work.

4. BORROW THE CRAFT, NOT THE COPY. Where the audit says a competitor did something better, take the technique — leading with the concrete fact, quoting the person, showing the object — never their words, their framing of our story, or claims only their reporting supports.

5. NO MARKETING VOICE. No "Dive in", "Don't miss", "We explore", "In our latest piece", "🔥 NEW". No rhetorical-question openings. Write the way the magazine writes: specific, unhurried, declarative.

6. THE LINK GOES WHERE IT WORKS. In the post on X, Farcaster and LinkedIn. Not in an Instagram caption, where it is not clickable — Instagram drafts say "link in bio" only if they need to.

7. IF THE STORY IS THIN, SAY SO. If the material you were given is a headline and nothing else, write what you can and say in "avoided" that the drafts rest on a headline alone and should be checked against the piece.

Return strict JSON only, no markdown fences, in exactly this shape:
{
  "angle": "one sentence: the thing about this story that makes someone stop scrolling",
  "drafts": [
    { "platform": "instagram|x|farcaster|zora|linkedin",
      "body": "the post, ready to publish, with real line breaks",
      "asset": "what to attach — the cover image, a specific photograph from the piece, a video, nothing",
      "rationale": "why it is shaped this way, naming the audit finding it answers where there is one",
      "confidence": "grounded|inferred",
      "tags": ["without the #"] }
  ],
  "avoided": ["a claim you did not make, and why"]
}`;

export async function composeDrafts(opts: {
  provider: EvalProvider;
  story: StoryBrief;
  platforms?: SocialPlatform[];
  /** The audit this draft should answer. Null when composing cold. */
  audit?: AuditEvidence | null;
}): Promise<ComposerResult> {
  const { provider, story, audit } = opts;
  const platforms = opts.platforms?.length ? opts.platforms : [...SOCIAL_PLATFORMS];
  const model = provider === 'claude' ? CLAUDE_OPUS : OPENAI_SOL;

  const prompt = [
    'THE STORY',
    `  Headline: ${story.title}`,
    story.author ? `  By: ${story.author}` : '',
    story.publishedAt ? `  Published: ${story.publishedAt.slice(0, 10)}` : '',
    `  URL: ${story.url}`,
    story.excerpt ? `  Standfirst: ${story.excerpt}` : '  Standfirst: (none)',
    '',
    story.opening
      ? `  OPENING OF THE PIECE:\n  ${story.opening.replace(/\s+/g, ' ').slice(0, 4_000)}`
      : '  OPENING OF THE PIECE: (not available — you have the headline and standfirst only. See rule 7.)',
    '',
    'PLATFORMS TO WRITE FOR',
    ...platforms.map((p) => `  • ${PLATFORM_BRIEFS[p]}`),
    '',
    renderAudit(audit ?? null, platforms),
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await runAgentChat({
    system: SYSTEM,
    message: prompt,
    maxTokens: Math.min(12_000, 2_500 + platforms.length * 1_200),
    maxRounds: 1,
    preferredProvider: provider,
    openaiModel: OPENAI_SOL,
    logTag: `probatio/social-composer:${provider}`,
  });

  return { ...parseDrafts(raw, story.title), model };
}

/**
 * The audit, as evidence.
 *
 * Scoped to the platform it was run on, and said so plainly. An Instagram
 * audit is evidence about Instagram; presenting it as general guidance would
 * hand the model Instagram's answer for a LinkedIn draft, which is exactly the
 * mistake rule 3 exists to prevent.
 */
function renderAudit(audit: AuditEvidence | null, platforms: SocialPlatform[]): string {
  if (!audit) {
    return [
      'THE AUDIT',
      '  None was supplied. Every draft rests on platform convention rather than on evidence about our own posts: mark them all "inferred".',
    ].join('\n');
  }

  const lines: string[] = [
    'THE AUDIT',
    `  Run on ${platformLabel(audit.platform)}${
      audit.score === null ? '' : `, where our post scored ${audit.score}/100`
    }. This is evidence about ${platformLabel(audit.platform)} specifically.`,
  ];

  if (platforms.some((p) => p !== audit.platform)) {
    lines.push(
      `  For the other platforms it is a signal about our house habits, not a finding about theirs — a draft shaped by it alone is still "inferred".`,
    );
  }

  if (audit.verdict) lines.push('', `  VERDICT: ${audit.verdict}`);

  if (audit.shortfalls.length) {
    lines.push('', '  WHERE OUR LAST POST FELL SHORT — do not repeat these:');
    for (const row of audit.shortfalls) {
      lines.push(`    • ${row.prompt}`);
      if (row.evidence) lines.push(`        we wrote: "${row.evidence}"`);
      if (row.rationale) lines.push(`        ${row.rationale}`);
    }
  }

  if (audit.differences.length) {
    lines.push('', '  AGAINST A COMPETITOR POST — borrow the technique, never the copy:');
    for (const row of audit.differences) {
      lines.push(`    ${row.dimension.toUpperCase()} (advantage: ${row.advantage})`);
      lines.push(`        ${row.difference}`);
      if (row.evidence) lines.push(`        theirs: "${row.evidence}"`);
    }
  }

  if (audit.recommendations.length) {
    lines.push('', '  THE EDITS THE JUDGE ASKED FOR:');
    for (const rec of audit.recommendations) {
      lines.push(`    [${rec.priority.toUpperCase()} · ${rec.effort}] ${rec.change}`);
      if (rec.rationale) lines.push(`        ${rec.rationale}`);
    }
  }

  return lines.join('\n');
}

export function parseDrafts(raw: string, storyTitle: string): Omit<ComposerResult, 'model'> {
  const parsed = parseAgentJson<any>(raw);

  if (!parsed.ok) {
    return {
      storyTitle,
      angle: '',
      drafts: [],
      avoided: [],
      parseError: `${parsed.error} The model's reply was:\n\n${parsed.raw.slice(0, 3_000)}`,
    };
  }

  const d = parsed.data;
  return {
    storyTitle,
    angle: str(d?.angle, 600),
    drafts: arrayOf<Draft>(d?.drafts, (row) => {
      const body = str(row?.body, 4_000);
      if (!body) return null;
      const platform = String(row?.platform ?? '').toLowerCase() as SocialPlatform;
      if (!SOCIAL_PLATFORMS.includes(platform)) return null;
      return {
        platform,
        body,
        asset: str(row?.asset, 500),
        rationale: str(row?.rationale, 1_200),
        confidence: oneOf(row?.confidence, ['grounded', 'inferred'] as const, 'inferred'),
        tags: arrayOf<string>(row?.tags, (t) => {
          const tag = str(t, 60).replace(/^#/, '').toLowerCase();
          return tag || null;
        }),
      };
    }),
    avoided: arrayOf<string>(d?.avoided, (a) => str(a, 500) || null),
    parseError: null,
  };
}

export function renderComposerSummary(r: ComposerResult): string {
  const lines: string[] = [];
  if (r.angle) lines.push(`ANGLE: ${r.angle}`, '');

  for (const draft of r.drafts) {
    lines.push(`── ${platformLabel(draft.platform).toUpperCase()} · ${draft.confidence} ──`);
    lines.push(draft.body);
    if (draft.tags.length) lines.push('', draft.tags.map((t) => `#${t}`).join(' '));
    if (draft.asset) lines.push('', `ASSET: ${draft.asset}`);
    if (draft.rationale) lines.push(`WHY: ${draft.rationale}`);
    lines.push('');
  }

  if (r.avoided.length) {
    lines.push('DELIBERATELY NOT CLAIMED:');
    for (const a of r.avoided) lines.push(`  • ${a}`);
  }

  return lines.join('\n');
}
