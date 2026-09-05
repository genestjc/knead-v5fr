/**
 * The story analyst — why does their piece win the citation, and what do we change?
 *
 * The rubric judge scores pass/fail against fixed rows. That is the right shape
 * for markup, which is either present or not. It is the wrong shape for the
 * question an editor is actually asking, which is comparative and open-ended:
 * five pieces exist about this person, an engine picks one, why isn't it ours?
 *
 * So this is a separate pass with a different output. It reads the real prose
 * of every piece alongside the deterministic signals and returns ranked,
 * specific edits. Two rules keep it from drifting into generic content advice:
 *
 *   • Every claim about a competitor must quote that competitor. An advantage
 *     nobody can point at in the text is an assertion, not a finding.
 *   • Recommendations must be things a writer could do to THIS piece. "Publish
 *     more original reporting" is not an edit; "the Hyperallergic piece quotes
 *     Nadler on his 2019 studio fire and ours doesn't — ask him about it" is.
 *
 * It runs Opus / Sol, matching the judge: this is low-volume and quality-first.
 */
import { runAgentChat, CLAUDE_OPUS, OPENAI_SOL } from '@/lib/ai/router';
import type { EvalProvider } from './types';
import type { StorySignals } from './aeo-story';

export interface CompetitorAdvantage {
  url: string;
  advantage: string;
  evidence: string;
}

export interface StoryRecommendation {
  priority: 'high' | 'medium' | 'low';
  change: string;
  rationale: string;
}

export interface StoryAnalysis {
  verdict: string;
  advantages: CompetitorAdvantage[];
  recommendations: StoryRecommendation[];
  model: string;
}

/** Body text is the bulk of this prompt; cap each piece so the call stays bounded. */
const PER_ARTICLE_CHARS = 6_000;

const ANALYST_SYSTEM = `You are an editorial analyst for a publication competing to be the source an AI answer engine cites.

You are given several articles about the same subject: one written by the publication you advise ("OURS"), and several by competitors. For each you get deterministic signals — subject coverage, markup, word count, quotation density — and the extracted body text.

Your job is to explain why a competitor would be cited instead of ours, and what to change.

Rules you do not break:
- Every claim about a competitor's advantage MUST quote that competitor's text. No quote, no finding.
- Recommendations must be concrete edits to OUR piece. "Add more depth" is useless. "Their piece dates the studio fire to 2019 and names the gallery; ours says 'a few years ago' — pin the date and name" is useful.
- Distinguish what is fixable in an edit from what would require new reporting, and say which is which.
- If ours is genuinely stronger on a dimension, say so. Do not manufacture deficits.
- Never claim a competitor said something it did not. If the extracted text is truncated or empty, say the evidence is insufficient rather than inventing it.
- Ignore navigation, cookie banners, and subscription prompts in the extracted text. They are page furniture, not the article.

Return strict JSON only, no markdown fences, in exactly this shape:
{
  "verdict": "2-4 sentences: the honest reason a competitor gets picked over ours, or why ours should already be winning.",
  "advantages": [
    { "url": "competitor url", "advantage": "what they have that we don't", "evidence": "a direct quote from their text" }
  ],
  "recommendations": [
    { "priority": "high" | "medium" | "low", "change": "the specific edit", "rationale": "why it moves citation" }
  ]
}`;

function renderArticle(s: StorySignals, isOurs: boolean, subject: string): string {
  const head = isOurs ? '=== OURS ===' : '=== COMPETITOR ===';
  const body = (s.extractedText ?? '').slice(0, PER_ARTICLE_CHARS);
  return [
    head,
    `URL: ${s.finalUrl || s.url}`,
    `Title: ${s.title ?? '(none)'}`,
    `Description: ${s.metaDescription ?? '(none)'}`,
    `Composite score: ${s.score}/100`,
    `Subject "${subject}" — title:${s.coverage.inTitle} description:${s.coverage.inDescription} ` +
      `schema.about:${s.coverage.inSchemaAbout} lede:${s.coverage.inOpening} mentions:${s.coverage.mentions}`,
    `Body: ${s.visibleWords} words · ${s.quotedPassages} quoted passages · ${s.specificityMarkers} specificity markers`,
    '',
    'EXTRACTED TEXT:',
    body || '(no text could be extracted — the page may be client-rendered or gated)',
    '',
  ].join('\n');
}

export async function analyzeStory(opts: {
  provider: EvalProvider;
  subject: string;
  ours: StorySignals;
  competitors: StorySignals[];
}): Promise<StoryAnalysis> {
  const { provider, subject, ours, competitors } = opts;
  const model = provider === 'claude' ? CLAUDE_OPUS : OPENAI_SOL;

  const prompt = [
    `SUBJECT: ${subject}`,
    '',
    `There are ${competitors.length + 1} pieces about this subject. Explain why a competitor would be cited over ours, and what to change.`,
    '',
    renderArticle(ours, true, subject),
    ...competitors.map((c) => renderArticle(c, false, subject)),
  ].join('\n');

  const raw = await runAgentChat({
    system: ANALYST_SYSTEM,
    message: prompt,
    // Each advantage carries a quote and each recommendation a rationale, so
    // the budget scales with how many competitors are in the comparison.
    maxTokens: Math.min(16_000, 3_000 + competitors.length * 1_200),
    maxRounds: 1,
    preferredProvider: provider,
    openaiModel: OPENAI_SOL,
    logTag: `probatio/aeo-analyst:${provider}`,
  });

  return { ...parseAnalysis(raw), model };
}

/**
 * Tolerant parse. The analyst returns JSON, but a model that wraps it in a
 * fence or prefixes a sentence shouldn't cost the whole run — the same failure
 * mode judge-json.ts exists to absorb.
 */
export function parseAnalysis(raw: string): Omit<StoryAnalysis, 'model'> {
  const empty: Omit<StoryAnalysis, 'model'> = { verdict: '', advantages: [], recommendations: [] };
  if (!raw?.trim()) return empty;

  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // Fall back to the outermost braces if the model prefixed prose.
  if (!text.startsWith('{')) {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) text = text.slice(first, last + 1);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Unparseable: keep the prose so the run still says something rather than
    // silently reporting no findings.
    return { ...empty, verdict: raw.slice(0, 2_000) };
  }

  const priorities = new Set(['high', 'medium', 'low']);

  return {
    verdict: typeof parsed?.verdict === 'string' ? parsed.verdict : '',
    advantages: Array.isArray(parsed?.advantages)
      ? parsed.advantages
          .filter((a: any) => a && typeof a.advantage === 'string')
          .map((a: any) => ({
            url: String(a.url ?? ''),
            advantage: String(a.advantage),
            evidence: String(a.evidence ?? ''),
          }))
      : [],
    recommendations: Array.isArray(parsed?.recommendations)
      ? parsed.recommendations
          .filter((r: any) => r && typeof r.change === 'string')
          .map((r: any) => ({
            priority: priorities.has(String(r.priority)) ? (String(r.priority) as StoryRecommendation['priority']) : 'medium',
            change: String(r.change),
            rationale: String(r.rationale ?? ''),
          }))
      : [],
  };
}

/** Flatten an analysis into the run summary field. */
export function renderAnalysisSummary(a: StoryAnalysis): string {
  const lines: string[] = [];
  if (a.verdict) lines.push(a.verdict, '');
  if (a.advantages.length) {
    lines.push('WHAT COMPETITORS HAVE:');
    for (const adv of a.advantages) {
      lines.push(`  • ${adv.advantage}`);
      if (adv.evidence) lines.push(`      "${adv.evidence}"`);
      if (adv.url) lines.push(`      — ${adv.url}`);
    }
    lines.push('');
  }
  if (a.recommendations.length) {
    lines.push('RECOMMENDED EDITS:');
    for (const rec of a.recommendations) {
      lines.push(`  [${rec.priority.toUpperCase()}] ${rec.change}`);
      if (rec.rationale) lines.push(`      ${rec.rationale}`);
    }
  }
  return lines.join('\n');
}
