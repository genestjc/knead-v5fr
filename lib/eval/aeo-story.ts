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
  /**
   * The page loaded but its prose never reached the extracted text.
   *
   * This distinction is the most important one this surface makes. A piece
   * with 13 extractable words is not a thin piece — it is very likely a real
   * article whose body is client-rendered, gated, or bot-blocked, and the two
   * have opposite fixes. Reading "13 words" as an editorial deficit sends a
   * writer off to pad an article that was already good, while the actual
   * problem is that no engine can read it.
   */
  extractionFailed: boolean;
  extractionDiagnosis: string | null;
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

/**
 * Did the article's prose actually reach us?
 *
 * An article page that returns 200 and yields almost no text has not told us
 * the piece is thin — it has told us we could not read it. Three shapes
 * account for nearly all of it, and each has a different fix, so name which
 * one rather than reporting a word count and letting a reader guess.
 */
function diagnoseExtraction(s: AeoSignals): { failed: boolean; diagnosis: string | null } {
  // A genuinely short piece is still a piece. Below this, on an article page,
  // the far more likely explanation is that the body never rendered.
  const MIN_PLAUSIBLE_ARTICLE_WORDS = 120;

  if (!s.ok) return { failed: false, diagnosis: null }; // unreachable is its own finding
  if (s.visibleWords >= MIN_PLAUSIBLE_ARTICLE_WORDS) return { failed: false, diagnosis: null };

  if (s.scriptTextRatio >= 0.8) {
    return {
      failed: true,
      diagnosis:
        `Only ${s.visibleWords} words reached the extracted text while ${Math.round(s.scriptTextRatio * 100)}% of the page's ` +
        `text sits inside <script>. The prose is shipping in a client-side payload, not in the document. ` +
        `Most AI crawlers do not execute JavaScript, so they receive what was extracted here — near enough to nothing. ` +
        `This is a rendering problem, not a writing problem.`,
    };
  }

  if (s.article.declaresPaywall) {
    return {
      failed: true,
      diagnosis:
        `Only ${s.visibleWords} words reached the extracted text, and the page declares a paywall. ` +
        `The body is gated before it reaches a crawler. That may be deliberate — but it means the piece cannot be ` +
        `cited from, and a licensed extract is what would make it quotable without giving it away.`,
    };
  }

  return {
    failed: true,
    diagnosis:
      `Only ${s.visibleWords} words reached the extracted text from a page that returned HTTP ${s.httpStatus}. ` +
      `That is too little for a real article, so treat this as a delivery failure until proven otherwise: ` +
      `check for bot protection on an unknown user-agent, a client-rendered body, or a redirect to a consent wall.`,
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
function buildStoryChecks(
  s: AeoSignals,
  coverage: SubjectCoverage,
  quoted: number,
  specificity: number,
  subject: string,
  extraction: { failed: boolean; diagnosis: string | null },
): SignalCheck[] {
  const checks: SignalCheck[] = [];
  const add = (id: string, label: string, status: SignalCheck['status'], detail: string, weight = 1) =>
    checks.push({ id, label, status, detail, weight });

  add('reachable', 'Article is reachable', s.ok ? 'pass' : 'fail', `HTTP ${s.httpStatus ?? '—'} in ${s.fetchMs}ms`, 1);

  add(
    'prose-reached-crawler',
    'The article body reached the crawler',
    extraction.failed ? 'fail' : 'pass',
    extraction.diagnosis ?? `${s.visibleWords} words extracted from the document`,
    4,
  );

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
    extraction.failed ? 'na' : coverage.inOpening ? 'pass' : 'fail',
    extraction.failed
      ? 'Not assessable — no body text reached the crawler to inspect a lede in'
      : coverage.inOpening
      ? 'Subject appears in the lede'
      : 'Subject not named in the opening — engines weight the lede heavily',
    extraction.failed ? 0 : 2,
  );
  add(
    'subject-full-name',
    'Uses the full name, not just a surname',
    extraction.failed ? 'na' : coverage.matchedFullName ? 'pass' : coverage.mentions > 0 ? 'warn' : 'fail',
    extraction.failed
      ? 'Not assessable — no body text reached the crawler'
      : coverage.matchedFullName
      ? `Full name present; ${coverage.mentions} mention(s)`
      : coverage.mentions > 0
      ? `Only a partial/surname match across ${coverage.mentions} mention(s) — harder to resolve to a person`
      : 'Subject never appears in the extracted text',
    extraction.failed ? 0 : 1,
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
    extraction.failed
      ? `${s.visibleWords} words — see "The article body reached the crawler" above for why`
      : `${s.visibleWords} words after stripping scripts and tags`,
    3,
  );
  add(
    'script-locked-text',
    'Prose is not locked inside scripts',
    s.scriptTextRatio <= 0.6 ? 'pass' : s.scriptTextRatio <= 0.85 ? 'warn' : 'fail',
    `${Math.round(s.scriptTextRatio * 100)}% of page text sits inside <script>`,
    2,
  );
  // When the body never reached us, everything downstream of the text is
  // unknown rather than absent. Scoring these as failures is what turns a
  // rendering bug into a false verdict about the writing.
  add(
    'original-quotation',
    'Carries quoted speech',
    extraction.failed ? 'na' : quoted >= 3 ? 'pass' : quoted >= 1 ? 'warn' : 'fail',
    extraction.failed
      ? 'Not assessable — the body did not reach the crawler, so this says nothing about the reporting'
      : `${quoted} quoted passage(s) — a proxy for original reporting an engine cannot source elsewhere`,
    extraction.failed ? 0 : 2,
  );
  add(
    'specificity',
    'Contains datable, specific claims',
    extraction.failed ? 'na' : specificity >= 12 ? 'pass' : specificity >= 4 ? 'warn' : 'fail',
    extraction.failed
      ? 'Not assessable — the body did not reach the crawler'
      : `${specificity} date/number markers — generic coverage gets synthesized, specific claims get cited`,
    extraction.failed ? 0 : 1,
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
    const extraction = diagnoseExtraction(base);

    // Replace the site-level check set with the story-scoped one. Origin checks
    // would otherwise mark every article on a feedless site down identically.
    const checks = base.ok
      ? buildStoryChecks(base, coverage, quoted, specificity, subject, extraction)
      : [{ id: 'reachable', label: 'Article is reachable', status: 'fail' as const, detail: base.error ?? `HTTP ${base.httpStatus ?? '—'}`, weight: 1 }];

    signals.push({
      ...base,
      coverage,
      quotedPassages: quoted,
      specificityMarkers: specificity,
      extractionFailed: extraction.failed,
      extractionDiagnosis: extraction.diagnosis,
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
  if (s.extractionFailed && s.extractionDiagnosis) {
    lines.push('⚠ EXTRACTION FAILURE — this is a delivery problem, not an editorial one:');
    lines.push(`  ${s.extractionDiagnosis}`);
    lines.push('  Do NOT read the counts below as evidence about the quality of the reporting.');
    lines.push('');
  }
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
