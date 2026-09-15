/**
 * The sentiment agent — what the replies actually say, and what to do about it.
 *
 * Sentiment scoring on social data is usually worthless for an editorial team,
 * for one reason: a percentage is not a decision. "68% positive" does not tell
 * an editor whether to correct something, answer someone, or commission a
 * follow-up. So this agent is built to produce the three things that do:
 *
 *   • THEMES — what people are actually talking about, weighted by how many
 *     said it, each carrying a real quote.
 *   • RISKS — anything a publication would want to know before tomorrow: a
 *     factual challenge, a subject or their representative objecting, a
 *     brewing pile-on, an accessibility or rights complaint.
 *   • VOICES — who is worth replying to, by influence or by relevance.
 *
 * The rules in the system prompt exist because each has a corresponding way of
 * being confidently wrong on this data: reading a small sample as a mood,
 * reading sarcasm as praise, reading an empty platform as a quiet one, and
 * inventing a quote nobody wrote.
 */
import { runAgentChat, CLAUDE_OPUS, OPENAI_SOL } from '@/lib/ai/router';
import { arrayOf, numberInRange, oneOf, parseAgentJson, str } from '@/lib/eval/json';
import { renderCaveats, renderCommentBlock, renderPostBlock } from './evidence';
import type { AgentProvider, SocialComment, SocialPost } from '../types';

export type Valence = 'positive' | 'negative' | 'mixed' | 'neutral';
export type Weight = 'dominant' | 'recurring' | 'isolated';
export type Severity = 'high' | 'medium' | 'low';

export interface SentimentQuote {
  quote: string;
  handle: string;
  platform: string;
}

export interface SentimentTheme {
  theme: string;
  valence: Valence;
  weight: Weight;
  evidence: SentimentQuote[];
}

export interface SentimentRisk {
  issue: string;
  severity: Severity;
  evidence: string;
  suggestedResponse: string;
}

export interface NotableVoice {
  handle: string;
  platform: string;
  why: string;
}

export interface SentimentReport {
  verdict: string;
  /**
   * Null when the sample is too thin to characterize, which is a real and
   * common outcome. A number here would be read as a measurement.
   */
  positiveShare: number | null;
  sampleSize: number;
  /** The agent's own statement of what this sample can and cannot support. */
  confidence: string;
  themes: SentimentTheme[];
  risks: SentimentRisk[];
  voices: NotableVoice[];
  model: string;
  /** Set when the model's reply could not be parsed; its prose is in `verdict`. */
  parseError: string | null;
}

const SYSTEM = `You are reading the replies to a magazine's social posts, on behalf of its editors.

Your output is used to decide what to answer, what to correct, and what to commission. A mood percentage is not a decision, so it is the least important thing you produce. Themes, risks and voices are the work.

WHAT YOU MUST GET RIGHT:

1. SAMPLE HONESTY. You are given a count of how many replies were collected. If that count is small (under about 25), say so in "confidence" and set "positiveShare" to null. Eleven replies are eleven people, not a readership. Never describe a small sample as "the audience", "readers", or "the response".

2. ABSENCE IS NOT SILENCE. A platform with no replies in this data did not necessarily draw none — read the DATA CAVEATS. Never write that a platform was quiet, ignored a post, or underperformed on engagement when what actually happened is that its reply text was not collected.

3. QUOTE OR DROP IT. Every theme carries at least one verbatim quote from the replies, with the handle who wrote it. If you cannot quote it, you have not observed it. Never paraphrase into the quote field, never merge two people's words into one quote, and never write a quote that does not appear in the text you were given.

4. SARCASM AND CRITICISM READ CORRECTLY. "Oh great, another think piece" is not positive. "This is devastating" about a story on a closure is praise, not a complaint. Read what the reply means in the context of the post it answers — you have the post.

5. RISKS ARE SPECIFIC. A risk is something an editor would act on before tomorrow: a factual challenge with detail behind it, a subject or their gallery/label/publicist objecting, a rights or permissions complaint, an accessibility failure, a pile-on forming. Generic negativity is not a risk. If there are none, return an empty list — do not manufacture one.

6. SUGGESTED RESPONSES ARE WRITEABLE. "Engage with the community" is not a response. "Reply to @handle confirming the 2019 date and linking the studio-fire report" is.

Return strict JSON only, no markdown fences, in exactly this shape:
{
  "verdict": "3-5 sentences: what the response to this work actually is, and the single thing an editor should do about it.",
  "positiveShare": 0-100 or null,
  "confidence": "one or two sentences on what this sample can support and what it cannot",
  "themes": [
    { "theme": "what people are saying", "valence": "positive|negative|mixed|neutral", "weight": "dominant|recurring|isolated",
      "evidence": [ { "quote": "verbatim reply text", "handle": "who wrote it", "platform": "instagram|x|farcaster|zora|linkedin" } ] }
  ],
  "risks": [
    { "issue": "what could go wrong", "severity": "high|medium|low", "evidence": "the verbatim reply behind it", "suggestedResponse": "the specific action" }
  ],
  "voices": [
    { "handle": "who", "platform": "where", "why": "why they are worth answering" }
  ]
}`;

export async function analyzeSentiment(opts: {
  provider: AgentProvider;
  posts: SocialPost[];
  comments: SocialComment[];
  caveats: string[];
  /** Optional narrowing — a story, subject, or campaign this read is about. */
  subject?: string | null;
}): Promise<SentimentReport> {
  const { provider, posts, comments, caveats, subject } = opts;
  const model = provider === 'claude' ? CLAUDE_OPUS : OPENAI_SOL;

  const ourPosts = posts.filter((p) => p.isOurs);
  const block = renderPostBlock('OUR POSTS IN THIS WINDOW', ourPosts, { maxPosts: 15 });

  const prompt = [
    subject ? `THIS READ IS ABOUT: ${subject}\n` : '',
    renderCaveats(caveats),
    `REPLY SAMPLE SIZE: ${comments.length} replies collected across ${new Set(comments.map((c) => c.platform)).size} platform(s).`,
    '',
    block.text,
    '',
    renderCommentBlock(ourPosts, comments),
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await runAgentChat({
    system: SYSTEM,
    message: prompt,
    // Themes and risks each carry verbatim evidence, so the budget scales with
    // how much there was to read.
    maxTokens: Math.min(14_000, 3_000 + comments.length * 60),
    maxRounds: 1,
    preferredProvider: provider,
    openaiModel: OPENAI_SOL,
    logTag: `social54/sentiment:${provider}`,
  });

  return { ...parseSentiment(raw, comments.length), model };
}

export function parseSentiment(raw: string, sampleSize: number): Omit<SentimentReport, 'model'> {
  const parsed = parseAgentJson<any>(raw);

  if (!parsed.ok) {
    return {
      // The prose is preserved rather than dropped — a failed parse still
      // contains the analysis, and an empty report would read as "no findings".
      verdict: parsed.raw.slice(0, 4_000),
      positiveShare: null,
      sampleSize,
      confidence: '',
      themes: [],
      risks: [],
      voices: [],
      parseError: parsed.error,
    };
  }

  const d = parsed.data;
  return {
    verdict: str(d?.verdict, 4_000),
    positiveShare: numberInRange(d?.positiveShare, 0, 100),
    sampleSize,
    confidence: str(d?.confidence, 600),
    themes: arrayOf<SentimentTheme>(d?.themes, (t) => {
      const theme = str(t?.theme, 400);
      if (!theme) return null;
      return {
        theme,
        valence: oneOf(t?.valence, ['positive', 'negative', 'mixed', 'neutral'] as const, 'neutral'),
        weight: oneOf(t?.weight, ['dominant', 'recurring', 'isolated'] as const, 'isolated'),
        evidence: arrayOf<SentimentQuote>(t?.evidence, (e) => {
          const quote = str(e?.quote, 800);
          if (!quote) return null;
          return { quote, handle: str(e?.handle, 80), platform: str(e?.platform, 40) };
        }),
      };
    }),
    risks: arrayOf<SentimentRisk>(d?.risks, (r) => {
      const issue = str(r?.issue, 500);
      if (!issue) return null;
      return {
        issue,
        severity: oneOf(r?.severity, ['high', 'medium', 'low'] as const, 'medium'),
        evidence: str(r?.evidence, 800),
        suggestedResponse: str(r?.suggestedResponse, 600),
      };
    }),
    voices: arrayOf<NotableVoice>(d?.voices, (v) => {
      const handle = str(v?.handle, 80);
      if (!handle) return null;
      return { handle, platform: str(v?.platform, 40), why: str(v?.why, 400) };
    }),
    parseError: null,
  };
}

/** Flatten a report into the run summary column. */
export function renderSentimentSummary(r: SentimentReport): string {
  const lines: string[] = [];
  if (r.verdict) lines.push(r.verdict, '');
  lines.push(
    `SAMPLE: ${r.sampleSize} replies` +
      (r.positiveShare !== null ? ` · ${Math.round(r.positiveShare)}% positive` : ' · share not characterized'),
  );
  if (r.confidence) lines.push(`  ${r.confidence}`);
  lines.push('');

  if (r.themes.length) {
    lines.push('THEMES:');
    for (const t of r.themes) {
      lines.push(`  [${t.weight.toUpperCase()} · ${t.valence}] ${t.theme}`);
      for (const e of t.evidence.slice(0, 2)) {
        lines.push(`      "${e.quote}" — @${e.handle} (${e.platform})`);
      }
    }
    lines.push('');
  }

  if (r.risks.length) {
    lines.push('RISKS:');
    for (const risk of r.risks) {
      lines.push(`  [${risk.severity.toUpperCase()}] ${risk.issue}`);
      if (risk.evidence) lines.push(`      "${risk.evidence}"`);
      if (risk.suggestedResponse) lines.push(`      → ${risk.suggestedResponse}`);
    }
    lines.push('');
  }

  if (r.voices.length) {
    lines.push('WORTH ANSWERING:');
    for (const v of r.voices) lines.push(`  @${v.handle} (${v.platform}) — ${v.why}`);
  }

  return lines.join('\n');
}
