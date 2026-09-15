/**
 * Parsing and rendering for the social judge.
 *
 * Split from judge.ts so it can be tested without importing lib/ai/router.ts,
 * which constructs its OpenAI client at module scope and throws on import when
 * OPENAI_API_KEY is unset. The pure half is also the half most worth testing:
 * scoring is where an LLM judge quietly produces a number that looks fine and
 * is not.
 */
import { arrayOf, numberInRange, oneOf, parseAgentJson, str } from '@/lib/eval/json';
import {
  weightedScore,
  type ComparisonRead,
  type CriterionScore,
  type JudgeCriterion,
  type Recommendation,
  type SentimentRead,
} from './types';
import type { JudgeOutput } from './judge';

export function parseJudgement(
  raw: string,
  criteria: JudgeCriterion[],
): Omit<JudgeOutput, 'model'> {
  const result = parseAgentJson<any>(raw);

  if (!result.ok) {
    return {
      // The prose is kept rather than dropped — a failed parse still contains
      // the analysis, and an empty report would read as "no findings".
      verdict: result.raw.slice(0, 4_000),
      scores: [],
      score: null,
      recommendations: [],
      sentiment: null,
      comparison: null,
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

  // Dedupe, last write wins — a repeated criterion would be double-counted by
  // the weighted score.
  const byCriterion = new Map(scores.map((s) => [s.criterionId, s]));
  const deduped = [...byCriterion.values()];

  const missing = criteria.filter((c) => !byCriterion.has(c.id)).length;
  if (missing > 0) {
    warnings.push(
      `${missing} of ${criteria.length} criteria were not returned by the judge and are unscored. The score below is computed from the rest.`,
    );
  }

  // A verdict with no evidence is an opinion. The rules say to abstain in that
  // case, so one that arrives anyway is downgraded rather than trusted.
  let unevidenced = 0;
  for (const score of deduped) {
    if (score.verdict !== 'na' && !score.evidence) {
      score.verdict = 'na';
      score.rationale = `${score.rationale} (Downgraded to N/A: the judge returned a verdict with no quoted evidence.)`.trim();
      unevidenced++;
    }
  }
  if (unevidenced > 0) {
    warnings.push(
      `${unevidenced} verdict(s) arrived without a supporting quote and were downgraded to N/A rather than counted.`,
    );
  }

  const sentimentRaw = d?.sentiment;
  const themes = arrayOf<SentimentRead['themes'][number]>(sentimentRaw?.themes, (t) => {
    const theme = str(t?.theme, 400);
    if (!theme) return null;
    return {
      theme,
      valence: oneOf(t?.valence, ['positive', 'negative', 'mixed', 'neutral'] as const, 'neutral'),
      quote: str(t?.quote, 600),
    };
  });

  const comparisonRaw = d?.comparison;

  return {
    verdict: str(d?.verdict, 4_000),
    scores: deduped,
    score: weightedScore(deduped, criteria),
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
          sampleSize: themes.length,
          themes,
          flags: arrayOf<string>(sentimentRaw?.flags, (f) => str(f, 500) || null),
        }
      : null,
    comparison: comparisonRaw
      ? {
          verdict: str(comparisonRaw?.verdict, 3_000),
          advantages: arrayOf<ComparisonRead['advantages'][number]>(
            comparisonRaw?.advantages,
            (a) => {
              const advantage = str(a?.advantage, 800);
              if (!advantage) return null;
              return {
                handle: str(a?.handle, 80),
                advantage,
                evidence: str(a?.evidence, 800),
              };
            },
          ),
          oursStronger: arrayOf<string>(comparisonRaw?.oursStronger, (o) => str(o, 500) || null),
          scoreboard: [],
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

/** Flatten a judgement into the stored summary. */
export function renderJudgementSummary(
  output: JudgeOutput,
  criteria: JudgeCriterion[],
): string {
  const byId = new Map(criteria.map((c) => [c.id, c]));
  const lines: string[] = [];

  if (output.score !== null) lines.push(`SCORE: ${output.score}/100 (weighted)`, '');
  if (output.verdict) lines.push(output.verdict, '');

  const failed = output.scores.filter((s) => {
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

  if (output.recommendations.length) {
    lines.push('CHANGE THIS:');
    for (const rec of output.recommendations) {
      lines.push(`  [${rec.priority.toUpperCase()} · ${rec.effort}] ${rec.change}`);
      if (rec.rationale) lines.push(`      ${rec.rationale}`);
    }
    lines.push('');
  }

  if (output.comparison) {
    lines.push('AGAINST THE FIELD:', output.comparison.verdict, '');
    for (const advantage of output.comparison.advantages) {
      lines.push(`  • ${advantage.advantage} — @${advantage.handle}`);
      if (advantage.evidence) lines.push(`      "${advantage.evidence}"`);
    }
    lines.push('');
  }

  if (output.sentiment) {
    lines.push('WHAT THE REPLIES SAID:', output.sentiment.summary);
    for (const flag of output.sentiment.flags) lines.push(`  ⚠ ${flag}`);
  }

  return lines.join('\n').trim();
}
