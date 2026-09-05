/**
 * Story-level AEO — why does *their* piece on this subject get cited and not ours?
 *
 * The site audit answers whether a publication is citable at all. It cannot
 * answer the question an editor actually has, because two well-marked articles
 * about the same person are not equally citable and markup does not say why.
 * That answer is in the prose: who has the original quote, who states a claim
 * an engine can lift, who names the subject in the first sentence.
 *
 * So this surface does two passes over the same set of URLs:
 *
 *   1. Deterministic — article-scoped markup plus subject coverage. Is the
 *      subject in the title, the description, the schema `about`, the opening?
 *      These are facts, and they are where most losses actually come from.
 *
 *   2. Editorial — the analyst (see aeo-analyst.ts) reads every piece and says
 *      what the competitors have that we don't. That is a judgement call and
 *      is labelled as one.
 *
 * Origin-level checks (robots, sitemap, feed) are deliberately absent. They
 * belong to the publication, not the story, and scoring five articles from one
 * site against them would just restate the site audit five times.
 */
import { auditUrl, type AeoSignals, type SignalCheck } from './aeo-signals';

export interface StoryTarget {
  url: string;
  isSubject: boolean;
}

export interface SubjectCoverage {
  inTitle: boolean;
  inDescription: boolean;
  inSchemaAbout: boolean;
  /** Named within the opening 120 words — where an engine looks for topicality. */
  inOpening: boolean;
  /** Total mentions in the extracted body. */
  mentions: number;
  /** Matched on the full name, or only on a surname-length token. */
  matchedFullName: boolean;
}

export interface StorySignals extends AeoSignals {
  coverage: SubjectCoverage;
  /** Rough count of quoted passages — a proxy for original reporting. */
  quotedPassages: number;
  /** Distinct four-digit years and numerals, a proxy for datable claims. */
  specificityMarkers: number;
}

export interface StoryOutcome {
  subject: string;
  signals: StorySignals[];
  subjectScore: number | null;
  fieldMedian: number | null;
  anyReachable: boolean;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word occurrences, so "art" does not match inside "artist". */
function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(needle)}(?![\\p{L}\\p{N}])`, 'giu');
  return (haystack.match(re) ?? []).length;
}

/**
 * Match the subject the way prose actually refers to people, and report how it
 * matched.
 *
 * A piece introduces "Richard Nadler" once and then says "Nadler" for the rest
 * of the article — that is normal writing, not a weak signal, so any component
 * of the name counts as a mention. Which component gets reused varies by name
 * and by culture, so this deliberately does not guess at name order or pick a
 * "surname": an earlier version took the longest token as the surname, which
 * for Richard Nadler selects "Richard" and scored a piece saying "Nadler"
 * throughout as never mentioning him at all.
 *
 * Whether the FULL name appears anywhere is tracked separately, because a
 * piece that only ever uses one name gives an engine less to resolve against a
 * person entity.
 */
function subjectMatcher(subject: string) {
  const full = subject.trim().toLowerCase();
  // Drop short connective words ("of", "the", "and") that would match anywhere.
  const tokens = full.split(/\s+/).filter((t) => t.length > 3);
  const candidates = tokens.length > 0 ? tokens : full ? [full] : [];

  return {
    full,
    candidates,
    test(text: string | null | undefined): { hit: boolean; fullHit: boolean } {
      if (!text || !full) return { hit: false, fullHit: false };
      const hay = text.toLowerCase();
      const fullHit = occurrences(hay, full) > 0;
      const hit = fullHit || candidates.some((t) => occurrences(hay, t) > 0);
      return { hit, fullHit };
    },
    /** The most-used component of the name — how often the piece refers to them. */
    count(text: string): number {
      if (!text || candidates.length === 0) return 0;
      const hay = text.toLowerCase();
      return Math.max(0, ...candidates.map((t) => occurrences(hay, t)));
    },
  };
}

function analyzeCoverage(signals: AeoSignals, subject: string): SubjectCoverage {
  const m = subjectMatcher(subject);
  const text = signals.extractedText ?? '';
  const opening = text.split(/\s+/).slice(0, 120).join(' ');

  const titleHit = m.test(signals.title);
  const descHit = m.test(signals.metaDescription);
  const openingHit = m.test(opening);
  const bodyHit = m.test(text);

  return {
    inTitle: titleHit.hit,
    inDescription: descHit.hit,
    inSchemaAbout: signals.article.hasAbout,
    inOpening: openingHit.hit,
    mentions: m.count(text),
    matchedFullName: titleHit.fullHit || descHit.fullHit || bodyHit.fullHit,
  };
}

/** Quoted passages — paired double quotes or typographic quote pairs. */
function countQuotedPassages(text: string): number {
  const straight = (text.match(/"[^"]{15,}"/g) ?? []).length;
  const curly = (text.match(/[“][^”]{15,}[”]/g) ?? []).length;
  return straight + curly;
}

/** Years and standalone numerals — a weak proxy for claims an engine can date. */
function countSpecificityMarkers(text: string): number {
  const years = new Set(text.match(/\b(19|20)\d{2}\b/g) ?? []);
  const numbers = (text.match(/\b\d[\d,.]*\b/g) ?? []).length;
  return years.size + Math.min(numbers, 40);
}

/**
 * Story-scoped checks. Weighted so subject resolution dominates: a piece that
 * never names its subject in the title or opening is not going to be retrieved
 * for that subject however well it is written.
 */
function buildStoryChecks(s: AeoSignals, coverage: SubjectCoverage, quoted: number, specificity: number, subject: string): SignalCheck[] {
  const checks: SignalCheck[] = [];
  const add = (id: string, label: string, status: SignalCheck['status'], detail: string, weight = 1) =>
    checks.push({ id, label, status, detail, weight });

  add('reachable', 'Article is reachable', s.ok ? 'pass' : 'fail', `HTTP ${s.httpStatus ?? '—'} in ${s.fetchMs}ms`, 1);

  add(
    'subject-in-title',
    `"${subject}" named in the title`,
    coverage.inTitle ? 'pass' : 'fail',
    coverage.inTitle ? `Title: ${s.title ?? ''}`.slice(0, 140) : `Title does not name the subject: ${s.title ?? '(none)'}`,
    3,
  );
  add(
    'subject-in-description',
    'Named in the description',
    coverage.inDescription ? 'pass' : 'fail',
    coverage.inDescription
      ? `${(s.metaDescription ?? '').slice(0, 120)}`
      : `Description does not name the subject: ${(s.metaDescription ?? '(none)').slice(0, 100)}`,
    3,
  );
  add(
    'subject-in-schema',
    'Declared as the article subject in schema',
    coverage.inSchemaAbout ? 'pass' : 'fail',
    coverage.inSchemaAbout
      ? 'Article carries an `about` entity'
      : 'No `about` in the Article schema — the piece never states who it is about in machine-readable form',
    2,
  );
  add(
    'subject-in-opening',
    'Named in the opening 120 words',
    coverage.inOpening ? 'pass' : 'fail',
    coverage.inOpening ? `Subject appears in the lede` : 'Subject not named in the opening — engines weight the lede heavily',
    2,
  );
  add(
    'subject-full-name',
    'Uses the full name, not just a surname',
    coverage.matchedFullName ? 'pass' : coverage.mentions > 0 ? 'warn' : 'fail',
    coverage.matchedFullName
      ? `Full name present; ${coverage.mentions} mention(s)`
      : coverage.mentions > 0
      ? `Only a partial/surname match across ${coverage.mentions} mention(s) — harder to resolve to a person`
      : 'Subject never appears in the extracted text',
    1,
  );

  add(
    'article-schema',
    'Article structured data present',
    s.article.found ? 'pass' : 'fail',
    s.article.found ? `Typed as ${s.schemaTypes.filter((t) => /Article|Posting|Report/.test(t)).join(', ')}` : 'No Article node',
    2,
  );
  add(
    'author-entity',
    'Byline is a resolvable entity',
    s.article.authorIsEntity ? 'pass' : s.article.hasAuthor ? 'warn' : 'fail',
    s.article.authorIsEntity
      ? 'Author carries @id / url / sameAs'
      : s.article.hasAuthor
      ? 'Author is a bare string'
      : 'No author declared',
    2,
  );
  add(
    'date-published',
    'Publication date declared',
    s.article.hasDatePublished ? 'pass' : 'fail',
    s.article.hasDatePublished ? 'datePublished present' : 'No datePublished — recency cannot be assessed',
    1,
  );

  add(
    'extractable-text',
    'Body survives extraction',
    s.visibleWords >= 400 ? 'pass' : s.visibleWords >= 150 ? 'warn' : 'fail',
    `${s.visibleWords} words after stripping scripts and tags`,
    3,
  );
  add(
    'script-locked-text',
    'Prose is not locked inside scripts',
    s.scriptTextRatio <= 0.6 ? 'pass' : s.scriptTextRatio <= 0.85 ? 'warn' : 'fail',
    `${Math.round(s.scriptTextRatio * 100)}% of page text sits inside <script>`,
    2,
  );
  add(
    'original-quotation',
    'Carries quoted speech',
    quoted >= 3 ? 'pass' : quoted >= 1 ? 'warn' : 'fail',
    `${quoted} quoted passage(s) — a proxy for original reporting an engine cannot source elsewhere`,
    2,
  );
  add(
    'specificity',
    'Contains datable, specific claims',
    specificity >= 12 ? 'pass' : specificity >= 4 ? 'warn' : 'fail',
    `${specificity} date/number markers — generic coverage gets synthesized, specific claims get cited`,
    1,
  );
  add(
    'paywall-declared',
    'Paywall declared to machines',
    s.article.declaresPaywall ? 'pass' : 'na',
    s.article.declaresPaywall ? 'isAccessibleForFree / hasPart present' : 'No paywall declaration (fine if free)',
    0,
  );

  return checks;
}

function scoreOf(checks: SignalCheck[]): number {
  const scored = checks.filter((c) => c.weight > 0 && c.status !== 'na');
  const total = scored.reduce((sum, c) => sum + c.weight, 0);
  if (total === 0) return 0;
  const earned = scored.reduce(
    (sum, c) => sum + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight * 0.5 : 0),
    0,
  );
  return Math.round((earned / total) * 100);
}

export async function runStoryAudit(subject: string, targets: StoryTarget[]): Promise<StoryOutcome> {
  const signals: StorySignals[] = [];
  // One origin's robots/sitemap is a site-level fact; fetch it at most once
  // even when several articles share a host.
  const seenOrigins = new Set<string>();

  for (const target of targets) {
    let base: AeoSignals;
    try {
      let origin = '';
      try {
        origin = new URL(target.url).origin;
      } catch {
        /* assertPublicUrl inside auditUrl will reject it properly */
      }
      const skipSiblings = origin !== '' && seenOrigins.has(origin);
      if (origin) seenOrigins.add(origin);
      base = await auditUrl(target.url, { keepText: true, skipSiblings });
    } catch (err: any) {
      base = failedSignals(target.url, err?.message ?? 'audit failed');
    }

    const coverage = analyzeCoverage(base, subject);
    const quoted = countQuotedPassages(base.extractedText ?? '');
    const specificity = countSpecificityMarkers(base.extractedText ?? '');

    // Replace the site-level check set with the story-scoped one. Origin checks
    // would otherwise mark every article on a feedless site down identically.
    const checks = base.ok
      ? buildStoryChecks(base, coverage, quoted, specificity, subject)
      : [{ id: 'reachable', label: 'Article is reachable', status: 'fail' as const, detail: base.error ?? `HTTP ${base.httpStatus ?? '—'}`, weight: 1 }];

    signals.push({
      ...base,
      coverage,
      quotedPassages: quoted,
      specificityMarkers: specificity,
      checks,
      score: scoreOf(checks),
    });
  }

  const subjectSignal = signals.find((_, i) => targets[i]?.isSubject) ?? null;
  const competitors = signals.filter((_, i) => !targets[i]?.isSubject && signals[i].ok);

  return {
    subject,
    signals,
    subjectScore: subjectSignal?.ok ? subjectSignal.score : null,
    fieldMedian: competitors.length ? median(competitors.map((c) => c.score)) : null,
    anyReachable: signals.some((s) => s.ok),
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function failedSignals(url: string, error: string): AeoSignals {
  return {
    url,
    finalUrl: url,
    ok: false,
    httpStatus: null,
    fetchMs: 0,
    error,
    title: null,
    metaDescription: null,
    ogType: null,
    ogSiteName: null,
    canonical: null,
    jsonLdBlocks: 0,
    jsonLdInvalid: 0,
    schemaTypes: [],
    organization: { found: false, isNewsMedia: false, sameAs: [], knowsAbout: [], hasPublishingPrinciples: false },
    article: {
      found: false,
      typedAsNews: false,
      hasAuthor: false,
      authorIsEntity: false,
      hasDatePublished: false,
      declaresPaywall: false,
      hasAbout: false,
    },
    feeds: [],
    visibleWords: 0,
    scriptTextRatio: 0,
    extractedText: '',
    robots: { exists: false, blocksAiCrawlers: [], declaresSitemap: false },
    sitemapExists: false,
    llmsTxtExists: false,
    checks: [],
    score: 0,
  };
}

/** Per-article report, used as the turn body the judge and analyst read. */
export function renderStoryReport(s: StorySignals, isSubject: boolean, subject: string): string {
  const lines: string[] = [];
  lines.push(`${isSubject ? 'OURS' : 'COMPETITOR'} — ${s.finalUrl || s.url}`);
  lines.push(`Score ${s.score}/100 on the subject "${subject}"`);
  if (s.error) lines.push(`FETCH ERROR: ${s.error}`);
  lines.push('');
  lines.push(`Title: ${s.title ?? '(none)'}`);
  lines.push(`Description: ${s.metaDescription ?? '(none)'}`);
  lines.push(
    `Subject coverage: title=${yn(s.coverage.inTitle)} description=${yn(s.coverage.inDescription)} ` +
      `schema.about=${yn(s.coverage.inSchemaAbout)} lede=${yn(s.coverage.inOpening)} ` +
      `mentions=${s.coverage.mentions} fullName=${yn(s.coverage.matchedFullName)}`,
  );
  lines.push(`Body: ${s.visibleWords} words · ${s.quotedPassages} quoted passage(s) · ${s.specificityMarkers} specificity markers`);
  lines.push('');
  for (const c of s.checks) lines.push(`[${c.status.toUpperCase().padEnd(4)}] ${c.label} — ${c.detail}`);
  return lines.join('\n');
}

function yn(v: boolean): string {
  return v ? 'yes' : 'NO';
}
