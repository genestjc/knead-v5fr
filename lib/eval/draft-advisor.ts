/**
 * The draft advisor — drafts the missing fields rather than listing them.
 *
 * A checklist telling an editor "no excerpt, no key facts, no subjects" gets
 * closed. The same editor handed a written excerpt, five extracted facts with
 * their dates, and the subject already named will accept or edit them. The
 * deterministic half in draft-check.ts says what is missing; this proposes the
 * content, drawn from the draft's own text.
 *
 * On grounding rather than training. The obvious idea is to train a model on
 * the audit runs we have accumulated. That would be a mistake: a handful of
 * runs is far too little to fine-tune on, and with no held-out set there would
 * be no way to tell whether it got worse. Instead the advisor is given real
 * findings from past comparisons on the same beat as context — "on the last
 * art interview, competitors won on dated collections and a named studio" is
 * more useful than a fine-tune, needs no training pipeline, and improves every
 * time an audit runs rather than requiring a retrain.
 *
 * Runs Opus / Sol, matching the judge and the story analyst: low volume,
 * quality first.
 */
import { runAgentChat, CLAUDE_OPUS, OPENAI_SOL } from '@/lib/ai/router'
import type { EvalProvider } from './types'
import type { DraftReport } from './draft-check'

export interface ProposedFact {
  fact: string
  when?: string
}

export interface DraftAdvice {
  /** Two or three sentences on what would keep this piece from being cited. */
  verdict: string
  proposedExcerpt: string | null
  proposedSubjects: Array<{ name: string; type: 'Person' | 'Organization' }>
  proposedKeyFacts: ProposedFact[]
  /** Edits that are not a field — things only a writer can do. */
  editorialNotes: string[]
  model: string
}

const ADVISOR_SYSTEM = `You advise an editor at an independent magazine, before a story publishes, on whether an answer engine will be able to cite it.

You are given a draft: its title, its current fields, a deterministic check report, and the body text. You propose the missing fields, drafted, ready to accept or edit.

Rules you do not break:
- Everything you propose must come from the draft's own text. Never invent a fact, a date, a name, or a collection that is not in the body. If the body does not support a fact, do not propose one.
- Only propose a date when the body states it. A fact with no date in the text gets no "when" — do not guess a year from context.
- The excerpt states what the piece establishes, in one or two sentences, under 300 characters. Lead with the specific: who, where, what happened. No teasers, no questions, no "this article", no "explores" or "delves into".
- Key facts are checkable and specific. "Trained as an investment banker before turning to generative art" is a fact. "Has an unconventional background" is not.
- Subjects are who or what the piece is ABOUT — the interviewee, the profiled artist, the restaurant. Not the author, and not every name mentioned in passing.
- Editorial notes are for things a field cannot fix: an unnamed source that could be named, a claim that wants a date the reporting does not have, a lede that takes too long to reach its subject. Say what to do, not that something is "weak".
- If a field is already filled and good, do not propose a replacement. Say nothing about it.

Return strict JSON only, no markdown fences:
{
  "verdict": "2-3 sentences on what would keep this piece from being cited, or that it is in good shape.",
  "proposedExcerpt": "the drafted excerpt, or null if the existing one is already good",
  "proposedSubjects": [{ "name": "...", "type": "Person" | "Organization" }],
  "proposedKeyFacts": [{ "fact": "...", "when": "2023" }],
  "editorialNotes": ["..."]
}`

export async function adviseDraft(opts: {
  provider: EvalProvider
  report: DraftReport
  reportText: string
  /** Findings from past audits on this beat — grounding, not training data. */
  precedent?: string[]
}): Promise<DraftAdvice> {
  const { provider, report, reportText, precedent = [] } = opts
  const model = provider === 'claude' ? CLAUDE_OPUS : OPENAI_SOL

  const prompt = [
    reportText,
    '',
    ...(precedent.length
      ? [
          'WHAT PREVIOUS COMPARISONS ON THIS BEAT FOUND — use as context for what competitors tend to carry, not as facts about this piece:',
          ...precedent.map((p) => `- ${p}`),
          '',
        ]
      : []),
    'DRAFT BODY:',
    report.bodyText || '(empty)',
  ].join('\n')

  const raw = await runAgentChat({
    system: ADVISOR_SYSTEM,
    message: prompt,
    maxTokens: 8_000,
    maxRounds: 1,
    preferredProvider: provider,
    openaiModel: OPENAI_SOL,
    logTag: `probatio/draft-advisor:${provider}`,
  })

  return { ...parseAdvice(raw), model }
}

/** Tolerant parse — a fenced or prose-prefixed response should not cost the run. */
export function parseAdvice(raw: string): Omit<DraftAdvice, 'model'> {
  const empty: Omit<DraftAdvice, 'model'> = {
    verdict: '',
    proposedExcerpt: null,
    proposedSubjects: [],
    proposedKeyFacts: [],
    editorialNotes: [],
  }
  if (!raw?.trim()) return empty

  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()
  if (!text.startsWith('{')) {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first !== -1 && last > first) text = text.slice(first, last + 1)
  }

  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ...empty, verdict: raw.slice(0, 2_000) }
  }

  const excerpt = typeof parsed?.proposedExcerpt === 'string' ? parsed.proposedExcerpt.trim() : ''

  return {
    verdict: typeof parsed?.verdict === 'string' ? parsed.verdict : '',
    proposedExcerpt: excerpt || null,
    proposedSubjects: Array.isArray(parsed?.proposedSubjects)
      ? parsed.proposedSubjects
          .filter((s: any) => typeof s?.name === 'string' && s.name.trim())
          .map((s: any) => ({
            name: String(s.name).trim(),
            type: s.type === 'Organization' ? ('Organization' as const) : ('Person' as const),
          }))
      : [],
    proposedKeyFacts: Array.isArray(parsed?.proposedKeyFacts)
      ? parsed.proposedKeyFacts
          .filter((f: any) => typeof f?.fact === 'string' && f.fact.trim())
          .map((f: any) => ({
            fact: String(f.fact).trim(),
            when: typeof f?.when === 'string' && f.when.trim() ? String(f.when).trim() : undefined,
          }))
      : [],
    editorialNotes: Array.isArray(parsed?.editorialNotes)
      ? parsed.editorialNotes.filter((n: any) => typeof n === 'string' && n.trim()).map((n: any) => n.trim())
      : [],
  }
}
