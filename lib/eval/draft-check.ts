/**
 * Draft checker — grade a story before it publishes, not after it loses.
 *
 * Everything else in this codebase measures published pages. That is the wrong
 * moment: by then the piece is live, the crawl has happened, and fixing it
 * means an edit and a re-crawl. This runs against a Sanity draft, where the
 * cost of a fix is a field.
 *
 * It is also simpler than the audit surfaces, because there is no page to
 * fetch and therefore no delivery layer to reason about. The document is the
 * input. Delivery is a property of the site, already measured by the site
 * audit, and not something a draft can get wrong.
 *
 * The checks are the ones the story audit found actually decide citations,
 * turned around to face forward: does this piece name its subject where an
 * engine looks, does it carry quotes only we have, does it pin dates, and is
 * it described in a sentence a machine can place.
 */
import type { SignalCheck } from './aeo-signals';

export interface DraftDocument {
  _id?: string;
  title?: string;
  excerpt?: string;
  body?: unknown[];
  subjects?: Array<{ name?: string; type?: string }>;
  keyFacts?: Array<{ fact?: string; when?: string; sourceUrl?: string }>;
  categories?: string[];
  author?: { name?: string; bio?: unknown[]; _id?: string } | null;
}

export interface DraftReport {
  title: string
  wordCount: number
  quotedPassages: number
  specificityMarkers: number
  /** The subject the piece is graded against — first entry in `subjects`. */
  primarySubject: string | null
  checks: SignalCheck[]
  score: number
  /** Plain-text body, capped, for the advisor to read. */
  bodyText: string
}

const MAX_ADVISOR_CHARS = 12_000

/** Portable Text → plain text. Blocks only; ignores images and embeds. */
export function portableTextToPlain(blocks: unknown): string {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((b: any) => b?._type === 'block' && Array.isArray(b.children))
    .map((b: any) => b.children.map((c: any) => c?.text ?? '').join(''))
    .join('\n\n')
    .trim()
}

/** Quoted passages — a proxy for reporting an engine cannot source elsewhere. */
export function countQuotedPassages(text: string): number {
  const straight = (text.match(/"[^"]{15,}"/g) ?? []).length
  const curly = (text.match(/[“][^”]{15,}[”]/g) ?? []).length
  return straight + curly
}

/** Years and numerals — a proxy for claims an engine can date. */
export function countSpecificityMarkers(text: string): number {
  const years = new Set(text.match(/\b(19|20)\d{2}\b/g) ?? [])
  const numbers = (text.match(/\b\d[\d,.]*\b/g) ?? []).length
  return years.size + Math.min(numbers, 40)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whole-word match, so "Art" does not match inside "artist". */
function mentions(haystack: string, needle: string): number {
  if (!needle) return 0
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(needle)}(?![\\p{L}\\p{N}])`, 'giu')
  return (haystack.match(re) ?? []).length
}

/**
 * Does the text name the subject? Any component of the name counts.
 *
 * Deliberately does not guess name order — an earlier version of this logic in
 * the story audit took the longest token as the surname, which for "Richard
 * Nadler" picks "Richard" and scored a piece saying "Nadler" throughout as
 * never mentioning him.
 */
function namesSubject(text: string, subject: string): boolean {
  const full = subject.trim().toLowerCase()
  if (!full) return false
  const hay = text.toLowerCase()
  if (mentions(hay, full) > 0) return true
  return full
    .split(/\s+/)
    .filter((t) => t.length > 3)
    .some((t) => mentions(hay, t) > 0)
}

/** Words search engines truncate past; answer engines read the whole string. */
const EXCERPT_MAX = 300

/**
 * Teaser language. An excerpt's job is to state what the piece establishes;
 * these phrasings withhold it, which is exactly what a machine cannot use.
 */
const TEASER_MARKERS = [
  'you won',
  "you'll never",
  'what happened next',
  'find out',
  'read on',
  'we explore',
  'we dive',
  'a look at',
  'takes a look',
  'delves into',
  'dives into',
  'this article',
  'this piece',
  'this story',
]

export function checkDraft(doc: DraftDocument): DraftReport {
  const bodyText = portableTextToPlain(doc.body)
  const words = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0
  const quoted = countQuotedPassages(bodyText)
  const specificity = countSpecificityMarkers(bodyText)
  const excerpt = (doc.excerpt ?? '').trim()
  const title = (doc.title ?? '').trim()

  const subjects = (doc.subjects ?? []).filter((s) => s?.name?.trim())
  const primarySubject = subjects[0]?.name?.trim() ?? null
  const keyFacts = (doc.keyFacts ?? []).filter((f) => f?.fact?.trim())
  const datedFacts = keyFacts.filter((f) => f.when?.trim())

  const checks: SignalCheck[] = []
  const add = (id: string, label: string, status: SignalCheck['status'], detail: string, weight = 1) =>
    checks.push({ id, label, status, detail, weight })

  // ── Description ──
  add(
    'excerpt-present',
    'Excerpt written',
    excerpt ? 'pass' : 'fail',
    excerpt
      ? `${excerpt.length} chars`
      : 'No excerpt — the description falls back to the article opening, which is a worse claim about the piece than a written one',
    3,
  )
  const teaser = TEASER_MARKERS.find((m) => excerpt.toLowerCase().includes(m))
  add(
    'excerpt-is-a-claim',
    'Excerpt states a claim, not a tease',
    !excerpt ? 'na' : teaser ? 'fail' : 'pass',
    !excerpt
      ? 'No excerpt to assess'
      : teaser
      ? `Contains teaser phrasing ("${teaser}") — say what the piece establishes instead`
      : 'Reads as a statement',
    excerpt ? 2 : 0,
  )
  add(
    'excerpt-length',
    'Excerpt within length',
    !excerpt ? 'na' : excerpt.length <= EXCERPT_MAX ? 'pass' : 'warn',
    !excerpt ? '—' : `${excerpt.length} / ${EXCERPT_MAX} chars`,
    excerpt ? 1 : 0,
  )

  // ── Subject resolution ──
  add(
    'subjects-tagged',
    'Subjects tagged',
    subjects.length > 0 ? 'pass' : 'fail',
    subjects.length
      ? subjects.map((s) => `${s.name} (${s.type ?? 'Person'})`).join(', ')
      : 'No subjects — the piece never states who or what it is about in machine-readable form',
    3,
  )
  add(
    'subject-in-title',
    'Subject named in the title',
    !primarySubject ? 'na' : namesSubject(title, primarySubject) ? 'pass' : 'fail',
    !primarySubject
      ? 'No subject tagged to check against'
      : namesSubject(title, primarySubject)
      ? `"${primarySubject}" appears in the title`
      : `Title does not name "${primarySubject}" — the strongest signal for a named-subject query`,
    primarySubject ? 3 : 0,
  )
  add(
    'subject-in-excerpt',
    'Subject named in the excerpt',
    !primarySubject || !excerpt ? 'na' : namesSubject(excerpt, primarySubject) ? 'pass' : 'fail',
    !primarySubject || !excerpt
      ? 'Needs both a subject and an excerpt'
      : namesSubject(excerpt, primarySubject)
      ? 'Named'
      : `Excerpt does not name "${primarySubject}"`,
    primarySubject && excerpt ? 2 : 0,
  )
  const opening = bodyText.split(/\s+/).slice(0, 120).join(' ')
  add(
    'subject-in-lede',
    'Subject named in the opening 120 words',
    !primarySubject || !bodyText ? 'na' : namesSubject(opening, primarySubject) ? 'pass' : 'fail',
    !primarySubject || !bodyText
      ? 'Needs both a subject and a body'
      : namesSubject(opening, primarySubject)
      ? 'Named in the lede'
      : `Not named in the opening — engines weight the lede heavily`,
    primarySubject && bodyText ? 2 : 0,
  )

  // ── Facts ──
  add(
    'key-facts',
    'Key facts recorded',
    keyFacts.length >= 3 ? 'pass' : keyFacts.length > 0 ? 'warn' : 'fail',
    keyFacts.length
      ? `${keyFacts.length} fact(s), ${datedFacts.length} dated`
      : 'No key facts — this is the field that wins "who is X" questions',
    3,
  )
  add(
    'facts-dated',
    'Facts carry dates',
    keyFacts.length === 0 ? 'na' : datedFacts.length >= Math.ceil(keyFacts.length / 2) ? 'pass' : 'warn',
    keyFacts.length === 0
      ? 'No facts to date'
      : `${datedFacts.length} of ${keyFacts.length} dated — an undated claim is harder to trust and harder to cite`,
    keyFacts.length ? 1 : 0,
  )
  add(
    'specificity',
    'Body carries datable specifics',
    specificity >= 12 ? 'pass' : specificity >= 4 ? 'warn' : 'fail',
    `${specificity} date/number markers — generic coverage gets synthesized, specific claims get cited`,
    2,
  )
  add(
    'original-quotation',
    'Carries quoted speech',
    quoted >= 3 ? 'pass' : quoted >= 1 ? 'warn' : 'fail',
    `${quoted} quoted passage(s) — what an engine cannot source anywhere else`,
    2,
  )

  // ── Substance and attribution ──
  add(
    'body-length',
    'Body has substance',
    words >= 400 ? 'pass' : words >= 150 ? 'warn' : 'fail',
    `${words} words`,
    2,
  )
  add(
    'author-set',
    'Author attached',
    doc.author?.name ? 'pass' : 'fail',
    doc.author?.name ? doc.author.name : 'No author — bylines are how a beat accumulates authority across pieces',
    2,
  )
  add(
    'author-bio',
    'Author has a bio',
    !doc.author?.name ? 'na' : portableTextToPlain(doc.author.bio) ? 'pass' : 'warn',
    !doc.author?.name
      ? 'No author'
      : portableTextToPlain(doc.author.bio)
      ? 'Present'
      : 'Empty bio — nothing for an engine to resolve the byline into',
    doc.author?.name ? 1 : 0,
  )
  add(
    'categories',
    'Categories set',
    (doc.categories?.length ?? 0) > 0 ? 'pass' : 'warn',
    doc.categories?.length ? doc.categories.join(', ') : 'None — the beat is left to be inferred',
    1,
  )

  return {
    title: title || '(untitled)',
    wordCount: words,
    quotedPassages: quoted,
    specificityMarkers: specificity,
    primarySubject,
    checks,
    score: scoreOf(checks),
    bodyText: bodyText.slice(0, MAX_ADVISOR_CHARS),
  }
}

function scoreOf(checks: SignalCheck[]): number {
  const scored = checks.filter((c) => c.weight > 0 && c.status !== 'na')
  const total = scored.reduce((sum, c) => sum + c.weight, 0)
  if (total === 0) return 0
  const earned = scored.reduce(
    (sum, c) => sum + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight * 0.5 : 0),
    0,
  )
  return Math.round((earned / total) * 100)
}

/** Readable report, and the evidence the advisor reads. */
export function renderDraftReport(r: DraftReport): string {
  const lines = [
    `DRAFT: ${r.title}`,
    `Score ${r.score}/100`,
    `Subject: ${r.primarySubject ?? '(none tagged)'}`,
    `Body: ${r.wordCount} words · ${r.quotedPassages} quoted passage(s) · ${r.specificityMarkers} specificity markers`,
    '',
  ]
  for (const c of r.checks) lines.push(`[${c.status.toUpperCase().padEnd(4)}] ${c.label} — ${c.detail}`)
  return lines.join('\n')
}
