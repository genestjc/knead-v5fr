/**
 * The composer — drafts for the stories we are actually publishing.
 *
 * A generic "write me a social post" agent produces copy that could be about
 * anything, which is why most of them get used once. This one is constrained
 * three ways, and the constraints are the product:
 *
 *   1. It writes about a REAL STORY, pulled from Sanity — the headline, the
 *      standfirst, and the opening of the piece. Nothing it claims may come
 *      from anywhere else, because a social post that overstates what the
 *      article says is a correction waiting to happen.
 *
 *   2. It is shown WHAT ACTUALLY WORKED on each platform, from our own
 *      collected posts, with the engagement rates attached. Format advice
 *      grounded in our own numbers beats format advice grounded in what an
 *      LLM remembers about Instagram in general.
 *
 *   3. It writes PER PLATFORM, and is told what each one rewards, because the
 *      single most common failure in social drafting is one caption
 *      reformatted five times. A cast is not a caption is not a LinkedIn post.
 *
 * It returns drafts as text ready to post, each with the reason it is shaped
 * that way, so an editor can disagree with the reasoning rather than just the
 * words.
 */
import { runAgentChat, CLAUDE_OPUS, OPENAI_SOL } from '@/lib/ai/router';
import { SITE_TOPICS } from '@/lib/constants';
import { rankPosts } from '../metrics';
import { platformLabel, SOCIAL_PLATFORMS, type AgentProvider, type SocialPlatform, type SocialPost } from '../types';
import { arrayOf, oneOf, parseAgentJson, str } from '@/lib/eval/json';
import { renderPost } from './evidence';

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
  /** What the account should attach — an image, the cover, a video, nothing. */
  asset: string;
  rationale: string;
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

/**
 * What each platform actually rewards, in Knead's mix.
 *
 * Written as editorial guidance rather than as rules a model can recite: the
 * point is to stop one caption being reformatted five times.
 */
const PLATFORM_BRIEFS: Record<SocialPlatform, string> = {
  instagram: [
    'Instagram: the image does the work and the caption earns the save. Open on the most specific concrete detail in the story — a date, a name, a number, a thing someone said — never on "Our new piece explores…". Reach here is saves-driven, so the caption should be worth keeping: a fact someone would screenshot. 2–5 short paragraphs. Link goes in bio, so the caption must stand alone. Hashtags are functional here, 5–10, specific over broad.',
  ].join(' '),
  x: [
    'X: the first line is the entire post as far as the timeline is concerned. State the finding, not the fact that we published something. No "🧵" theatre unless there is a real thread. Quote-posts and replies are where reach comes from, so give people something to argue with or add to. Link at the end. One or two hashtags at most — more reads as marketing.',
  ].join(' '),
  farcaster: [
    'Farcaster: a small, technical, onchain-native readership that dislikes being marketed to. Write as a person, not a brand — first person is fine. The channel rewards a genuine opinion or an unexpected detail over a headline restatement. Embeds render, so the link belongs in the cast. Under 320 characters. Hashtags are close to meaningless here; skip them.',
  ].join(' '),
  zora: [
    'Zora: the post IS the collectible, so the text is a caption for something being minted, not an announcement about an article. Say what the piece is and why it is worth holding. Collecting costs money, so the ask has to be honest about what someone gets. No hashtags.',
  ].join(' '),
  linkedin: [
    'LinkedIn: press, partnerships, the trade. The story is the evidence, the post is the argument about the industry it sits in. Longer is fine — 3–6 short paragraphs — but the first two lines are what gets seen before "see more". No hashtag walls; two or three at most. Never write in the LinkedIn register of rhetorical questions and one-line paragraphs.',
  ].join(' '),
};

const SYSTEM = `You write social posts for Knead, an independent magazine covering ${SITE_TOPICS.join(', ')}.

You are given one real story — headline, standfirst, opening — and, for each platform, the posts of ours that actually performed best with their engagement rates. You write a draft per platform.

RULES YOU DO NOT BREAK:

1. ONLY WHAT THE STORY SAYS. Every factual claim in every draft must be supported by the story text you were given. If the story does not name the date, you do not name the date. If you want to say something the story does not support, put it in "avoided" instead and say why. An overstated social post is a correction the magazine has to publish.

2. NO TWO DRAFTS ARE THE SAME POST. Each platform brief tells you what that platform rewards. A caption reformatted five times is the failure mode here. If two drafts could swap platforms without anyone noticing, you have not done the work.

3. GROUND THE FORMAT IN OUR OWN NUMBERS. You are shown which of our posts performed and at what rate. When you shape a draft around that evidence, set confidence to "grounded" and name the evidence in the rationale. When there is no evidence for a platform — no posts, or no rates — set "inferred" and say the choice rests on platform convention rather than our data. Never present a hunch as a finding.

4. NO MARKETING VOICE. No "Dive in", "Don't miss", "We explore", "In our latest piece", "🔥 NEW". No rhetorical-question openings. Write the way the magazine writes: specific, unhurried, declarative.

5. THE LINK GOES WHERE IT WORKS. In the post on X, Farcaster and LinkedIn. Not in an Instagram caption, where it is not clickable — Instagram drafts say "link in bio" only if they need to.

6. IF THE STORY IS THIN, SAY SO. If the material you were given is a headline and nothing else, write what you can and say in "avoided" that the drafts rest on a headline alone and should be checked against the piece.

Return strict JSON only, no markdown fences, in exactly this shape:
{
  "angle": "one sentence: the thing about this story that makes someone stop scrolling",
  "drafts": [
    { "platform": "instagram|x|farcaster|zora|linkedin",
      "body": "the post, ready to publish, with real line breaks",
      "asset": "what to attach — the cover image, a specific photograph from the piece, a video, nothing",
      "rationale": "why it is shaped this way, citing our evidence where it exists",
      "confidence": "grounded|inferred",
      "tags": ["without the #"] }
  ],
  "avoided": ["a claim you did not make, and why"]
}`;

export async function composeDrafts(opts: {
  provider: AgentProvider;
  story: StoryBrief;
  /** Our own collected posts — the format evidence. */
  ourPosts: SocialPost[];
  platforms?: SocialPlatform[];
}): Promise<ComposerResult> {
  const { provider, story, ourPosts } = opts;
  const platforms = opts.platforms?.length ? opts.platforms : SOCIAL_PLATFORMS;
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
      : '  OPENING OF THE PIECE: (not available — you have the headline and standfirst only. See rule 6.)',
    '',
    'PLATFORMS TO WRITE FOR',
    ...platforms.map((p) => `  • ${PLATFORM_BRIEFS[p]}`),
    '',
    renderEvidence(ourPosts, platforms),
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
    logTag: `social54/composer:${provider}`,
  });

  return { ...parseDrafts(raw, story.title), model };
}

/**
 * Our best-performing posts per platform, as format evidence.
 *
 * Reported per platform rather than pooled: what earns a save on Instagram and
 * what earns a quote-post on X have nothing to do with each other, and a
 * pooled "here's what works" list would hand the agent Instagram's answer for
 * an X draft.
 */
function renderEvidence(ourPosts: SocialPost[], platforms: SocialPlatform[]): string {
  const lines: string[] = [
    'WHAT HAS ACTUALLY WORKED FOR US',
    '(our own posts, ranked by engagement rate. Use these for format decisions; see rule 3.)',
    '',
  ];

  for (const platform of platforms) {
    const posts = ourPosts.filter((p) => p.isOurs && p.platform === platform);
    if (posts.length === 0) {
      lines.push(
        `── ${platformLabel(platform).toUpperCase()} ── no collected posts. Any format choice here is convention, not evidence: mark the draft "inferred".`,
        '',
      );
      continue;
    }
    const ranked = rankPosts(posts, 4);
    lines.push(`── ${platformLabel(platform).toUpperCase()} ──`);
    for (const [i, entry] of ranked.entries()) {
      lines.push(renderPost(entry.post, `${platform.toUpperCase()}-BEST-${i + 1}`));
      if (entry.rankedBy === 'total') {
        lines.push(
          '      (ranked on raw engagement — no follower count was available, so this is not a rate)',
        );
      }
      lines.push('');
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
