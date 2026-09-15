/**
 * On-page SEO facts, read out of the same HTML the AEO audit already fetched.
 *
 * WHY THIS IS SEPARATE FROM THE AEO CHECKS. They answer different questions and
 * a reader needs to know which one a finding belongs to. AEO asks whether an
 * answer engine can identify, trust and quote a piece — schema, entity
 * resolution, whether the prose reaches a crawler at all. SEO asks whether a
 * search engine can index it and whether a person will click it: the title
 * fits, there is one H1, the images have alt text, the piece links to and from
 * the rest of the site. Both are computed from the same document, both matter,
 * and conflating them produces a single number that tells you nothing about
 * which of the two you are losing.
 *
 * EVERYTHING HERE IS A FACT, NOT A JUDGEMENT. These are counts and lengths,
 * computed the same way every time, and they belong nowhere near an LLM judge
 * — a model asked "is the title a good length" gives a different answer on
 * Tuesday. lib/eval/rubric-seed.ts makes this point about the AEO surfaces
 * having no rubric rows; the same reasoning applies to every check below.
 *
 * REGEX, NOT A DOM PARSER. Consistent with the rest of aeo-signals.ts: this
 * runs on a serverless function against pages it does not control, and pulling
 * in a full HTML parser to count <h2> tags is a dependency and a startup cost
 * for no accuracy that matters. The failure mode of a regex here is a miscount
 * on pathological markup, which is a wrong number in one check — not a wrong
 * verdict about the writing.
 */

// Type-only, so there is no runtime import cycle with aeo-signals.ts (which
// imports the extractor below as a value).
import type { AeoSignals, SignalCheck } from './aeo-signals';

export interface SeoSignals {
  titleLength: number;
  descriptionLength: number;
  /** Every H1 on the page, in document order. More than one is the finding. */
  h1s: string[];
  /** Heading levels in document order — [1, 2, 2, 3, 2] — for the skip check. */
  headingLevels: number[];
  h2Count: number;
  /** Same-origin links in the document. Site architecture, and crawl depth. */
  internalLinks: number;
  /** Links off the origin. A piece that cites nothing sources nothing. */
  externalLinks: number;
  images: number;
  imagesWithAlt: number;
  /** alt="" is a deliberate mark for decoration, not a missing alt. */
  imagesDecorative: number;
  /** Canonical points at this page rather than at another one. */
  canonicalSelfReferential: boolean;
  hasOgTitle: boolean;
  hasOgDescription: boolean;
  hasOgImage: boolean;
  hasTwitterCard: boolean;
  /** Last path segment, hyphens split into words. Empty for a bare origin. */
  slugWords: string[];
  /** A robots meta that keeps the page out of the index entirely. */
  noindex: boolean;
}

export function emptySeoSignals(): SeoSignals {
  return {
    titleLength: 0,
    descriptionLength: 0,
    h1s: [],
    headingLevels: [],
    h2Count: 0,
    internalLinks: 0,
    externalLinks: 0,
    images: 0,
    imagesWithAlt: 0,
    imagesDecorative: 0,
    canonicalSelfReferential: false,
    hasOgTitle: false,
    hasOgDescription: false,
    hasOgImage: false,
    hasTwitterCard: false,
    slugWords: [],
    noindex: false,
  };
}

/** Strip tags and collapse whitespace inside a heading's inner HTML. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasMeta(html: string, name: string, attr: 'property' | 'name'): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forward = new RegExp(
    `<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']\\s*[^"'\\s][^"']*["']`,
    'i',
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']\\s*[^"'\\s][^"']*["'][^>]+${attr}=["']${escaped}["']`,
    'i',
  );
  return forward.test(html) || reversed.test(html);
}

export function readSeoSignals(opts: {
  html: string;
  finalUrl: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
}): SeoSignals {
  const { html, finalUrl } = opts;
  const signals = emptySeoSignals();

  signals.titleLength = (opts.title ?? '').trim().length;
  signals.descriptionLength = (opts.metaDescription ?? '').trim().length;

  // ── headings ──────────────────────────────────────────────────────────────
  const headingRe = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let heading: RegExpExecArray | null;
  while ((heading = headingRe.exec(html))) {
    const level = Number(heading[1]);
    signals.headingLevels.push(level);
    if (level === 1) {
      const text = textOf(heading[2]);
      if (text) signals.h1s.push(text);
    }
    if (level === 2) signals.h2Count++;
  }

  // ── links ─────────────────────────────────────────────────────────────────
  let origin = '';
  try {
    origin = new URL(finalUrl).origin;
  } catch {
    /* a malformed final URL means everything reads as external, which is the
       safer direction: it under-reports internal linking rather than inventing
       it. */
  }

  const linkRe = /<a\b[^>]*\bhref=["']([^"']+)["']/gi;
  let link: RegExpExecArray | null;
  while ((link = linkRe.exec(html))) {
    const href = link[1].trim();
    // Fragments, mailto:, tel: and javascript: are not navigation to a page.
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    try {
      const resolved = new URL(href, finalUrl || undefined);
      if (origin && resolved.origin === origin) signals.internalLinks++;
      else signals.externalLinks++;
    } catch {
      /* an unresolvable href is not a link to anywhere */
    }
  }

  // ── images ────────────────────────────────────────────────────────────────
  const imgRe = /<img\b[^>]*>/gi;
  for (const tag of html.match(imgRe) ?? []) {
    signals.images++;
    const alt = tag.match(/\balt=["']([^"']*)["']/i);
    if (!alt) continue;
    // alt="" is how you mark an image as decorative. That is correct markup,
    // not a missing alt, and counting it as a failure would push someone to
    // write alt text for a spacer gif.
    if (alt[1].trim()) signals.imagesWithAlt++;
    else signals.imagesDecorative++;
  }

  // ── head declarations ─────────────────────────────────────────────────────
  if (opts.canonical) {
    try {
      const canonical = new URL(opts.canonical, finalUrl || undefined);
      const current = new URL(finalUrl);
      // Compared without the query or the trailing slash: ?utm_source and a
      // missing slash are the same page, and reporting them as a canonical
      // conflict sends someone hunting for a problem that is not there.
      signals.canonicalSelfReferential =
        canonical.origin === current.origin &&
        canonical.pathname.replace(/\/+$/, '') === current.pathname.replace(/\/+$/, '');
    } catch {
      signals.canonicalSelfReferential = false;
    }
  }

  signals.hasOgTitle = hasMeta(html, 'og:title', 'property');
  signals.hasOgDescription = hasMeta(html, 'og:description', 'property');
  signals.hasOgImage = hasMeta(html, 'og:image', 'property');
  signals.hasTwitterCard = hasMeta(html, 'twitter:card', 'name');

  const robots = html.match(
    /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i,
  )?.[1];
  signals.noindex = /\bnoindex\b/i.test(robots ?? '');

  // ── slug ──────────────────────────────────────────────────────────────────
  try {
    const path = new URL(finalUrl).pathname.replace(/\/+$/, '');
    const last = path.split('/').filter(Boolean).pop() ?? '';
    signals.slugWords = last
      .replace(/\.(html?|php|aspx?)$/i, '')
      .split(/[-_]+/)
      .map((w) => w.toLowerCase())
      .filter(Boolean);
  } catch {
    /* no slug to read */
  }

  return signals;
}

/** Heading levels that jump more than one at a time — h2 straight to h4. */
export function skippedHeadingLevels(levels: number[]): number[] {
  const skipped: number[] = [];
  let previous: number | null = null;
  for (const level of levels) {
    // Only a jump DOWN the hierarchy is a skip. Going back up (h3 → h2) is a
    // new section, which is how documents are supposed to be structured.
    if (previous !== null && level > previous + 1) skipped.push(level);
    previous = level;
  }
  return skipped;
}

export function altTextShare(signals: SeoSignals): number | null {
  // Decorative images are excluded from both halves: they neither need alt
  // text nor count against the page for not having it.
  const needing = signals.images - signals.imagesDecorative;
  if (needing <= 0) return null;
  return signals.imagesWithAlt / needing;
}

// ─── the checks ──────────────────────────────────────────────────────────────

/**
 * On-page SEO checks, scored alongside the AEO ones.
 *
 * Every id here is prefixed `seo-`, which is what lets the console group them
 * under their own heading and what lets the field comparison say "behind the
 * field on SEO" separately from "behind the field on AEO".
 *
 * The thresholds are the conventional ones and are deliberately generous at
 * the edges: a 62-character title is not a problem, a 95-character title is.
 * Warning rather than failing on a near miss keeps the score from moving on
 * something nobody should spend an afternoon fixing.
 */
export function buildSeoChecks(
  s: AeoSignals,
  opts: { subject?: string | null; isArticle: boolean; extractionFailed?: boolean } = {
    isArticle: true,
  },
): SignalCheck[] {
  const seo = s.seo;
  const checks: SignalCheck[] = [];
  const add = (
    id: string,
    label: string,
    status: SignalCheck['status'],
    detail: string,
    weight = 1,
  ) => checks.push({ id: `seo-${id}`, label, status, detail, weight });

  // A page carrying noindex is not competing in search at all, which makes it
  // the finding that outranks every other one here.
  add(
    'indexable',
    'The page is open to indexing',
    seo.noindex ? 'fail' : 'pass',
    seo.noindex
      ? 'A robots meta tag declares noindex — this page is asking not to be in the index, so nothing else on this list can help it'
      : 'No noindex directive',
    4,
  );

  add(
    'title-length',
    'Title fits a result listing',
    seo.titleLength === 0
      ? 'fail'
      : seo.titleLength >= 15 && seo.titleLength <= 65
      ? 'pass'
      : 'warn',
    seo.titleLength === 0
      ? 'No <title>'
      : `${seo.titleLength} characters. Listings truncate around 60 — past that the end of the title is the part nobody reads.`,
    2,
  );

  add(
    'description-length',
    'Description fits a result listing',
    seo.descriptionLength === 0
      ? 'fail'
      : seo.descriptionLength >= 70 && seo.descriptionLength <= 165
      ? 'pass'
      : 'warn',
    seo.descriptionLength === 0
      ? 'No meta description — the engine writes its own snippet from whatever it finds'
      : `${seo.descriptionLength} characters; the useful range is roughly 70–160.`,
    2,
  );

  add(
    'single-h1',
    'Exactly one H1',
    seo.h1s.length === 1 ? 'pass' : 'fail',
    seo.h1s.length === 0
      ? 'No H1 — nothing on the page states its own headline in markup'
      : seo.h1s.length === 1
      ? `H1: ${seo.h1s[0].slice(0, 120)}`
      : `${seo.h1s.length} H1s: ${seo.h1s.slice(0, 3).map((h) => `"${h.slice(0, 50)}"`).join(', ')} — a page with several headlines has none`,
    2,
  );

  const skipped = skippedHeadingLevels(seo.headingLevels);
  add(
    'heading-structure',
    'Headings nest without skipping a level',
    seo.headingLevels.length === 0
      ? 'fail'
      : skipped.length === 0
      ? 'pass'
      : 'warn',
    seo.headingLevels.length === 0
      ? 'No headings at all'
      : skipped.length === 0
      ? `${seo.headingLevels.length} heading(s), ${seo.h2Count} at H2`
      : `Jumps a level ${skipped.length} time(s) — e.g. straight to H${skipped[0]}. Screen readers and outline extractors read the hierarchy literally.`,
    1,
  );

  if (opts.isArticle) {
    add(
      'internal-links',
      'Links into the rest of the site',
      seo.internalLinks >= 3 ? 'pass' : seo.internalLinks >= 1 ? 'warn' : 'fail',
      `${seo.internalLinks} same-origin link(s). Internal links are how a crawler finds the rest of the archive and how a reader stays past one piece.`,
      2,
    );
    add(
      'outbound-links',
      'Cites sources off-site',
      seo.externalLinks >= 1 ? 'pass' : 'warn',
      seo.externalLinks >= 1
        ? `${seo.externalLinks} outbound link(s)`
        : 'No outbound links — a piece that cites nothing looks like a piece that sourced nothing',
      1,
    );
  }

  const altShare = altTextShare(seo);
  add(
    'image-alt',
    'Images carry alt text',
    altShare === null ? 'na' : altShare >= 0.9 ? 'pass' : altShare >= 0.5 ? 'warn' : 'fail',
    altShare === null
      ? seo.images === 0
        ? 'No images on the page'
        : `All ${seo.images} image(s) are marked decorative (alt="")`
      : `${seo.imagesWithAlt} of ${seo.images - seo.imagesDecorative} non-decorative image(s) have alt text` +
        (seo.imagesDecorative ? `, plus ${seo.imagesDecorative} correctly marked decorative` : ''),
    altShare === null ? 0 : 1,
  );

  add(
    'canonical',
    'Canonical points at this page',
    !s.canonical ? 'fail' : seo.canonicalSelfReferential ? 'pass' : 'warn',
    !s.canonical
      ? 'No canonical link — duplicates of this URL compete with it'
      : seo.canonicalSelfReferential
      ? 'Self-referential canonical'
      : `Canonical points elsewhere: ${s.canonical.slice(0, 120)} — deliberate on a syndicated piece, a mistake otherwise`,
    2,
  );

  const cards = [seo.hasOgTitle, seo.hasOgDescription, seo.hasOgImage].filter(Boolean).length;
  add(
    'social-card',
    'Shares with a real preview',
    cards === 3 ? 'pass' : cards >= 1 ? 'warn' : 'fail',
    cards === 3
      ? `og:title, og:description and og:image all present${seo.hasTwitterCard ? ', plus a twitter:card' : ''}`
      : `${cards} of 3 Open Graph tags present — a link posted without them renders as a bare URL`,
    1,
  );

  // Subject checks only exist on a story audit, where there is a subject.
  const subject = opts.subject?.trim();
  if (subject) {
    const wanted = subject
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3);

    const h1 = seo.h1s.join(' ').toLowerCase();
    const inH1 = wanted.length > 0 && wanted.some((t) => h1.includes(t));
    add(
      'subject-in-h1',
      `"${subject}" named in the H1`,
      seo.h1s.length === 0 ? 'na' : inH1 ? 'pass' : 'fail',
      seo.h1s.length === 0
        ? 'No H1 to check'
        : inH1
        ? `H1: ${seo.h1s[0].slice(0, 120)}`
        : `H1 does not name the subject: ${seo.h1s[0]?.slice(0, 120) ?? ''}`,
      seo.h1s.length === 0 ? 0 : 2,
    );

    const slug = seo.slugWords.join('-');
    const inSlug = wanted.length > 0 && wanted.some((t) => slug.includes(t));
    add(
      'subject-in-slug',
      'Named in the URL',
      seo.slugWords.length === 0 ? 'na' : inSlug ? 'pass' : 'warn',
      seo.slugWords.length === 0
        ? 'No slug to read'
        : inSlug
        ? `/${slug}`
        : `/${slug} — the URL is one of the few parts of a result a reader scans before clicking`,
      seo.slugWords.length === 0 ? 0 : 1,
    );
  }

  return checks;
}
