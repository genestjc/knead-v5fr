/**
 * AEO signal extraction — what an answer engine actually receives from a page.
 *
 * This is the evidence-gathering half of the AEO Audit surface. It fetches a
 * publication's homepage (plus robots.txt, sitemap.xml and llms.txt) and pulls
 * out the signals that decide whether an engine can (a) tell what kind of
 * organization it is looking at and (b) quote the writing with attribution.
 *
 * Everything here is deterministic. No model is involved in extraction — the
 * judge grades the rubric against these findings, but the findings themselves
 * are facts about the bytes, which is what makes a benchmark defensible.
 *
 * Parsing is done with regexes rather than a DOM library on purpose: this runs
 * in a serverless function against pages that are frequently malformed, and
 * adding jsdom to the bundle to read six meta tags is a bad trade. The parsing
 * is tolerant by design — a page that fails to parse scores as missing signal,
 * which is the same thing a crawler would conclude.
 *
 * Two signals here are not in the standard SEO toolkit and matter most for
 * publishers:
 *
 *   • `visibleWords` — the body text left after scripts and tags are stripped,
 *     which is what a readability-style extractor sees. A long feature that
 *     extracts to two paragraphs is thin content to an engine no matter how it
 *     renders in a browser.
 *
 *   • `scriptTextRatio` — how much of the page's text lives *only* inside
 *     script tags. A high ratio on an article page is the fingerprint of
 *     client-side rendering or a client-side paywall: the prose ships in the
 *     RSC/JSON payload but never reaches the extracted text.
 */

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'na';

export interface SignalCheck {
  id: string;
  label: string;
  status: CheckStatus;
  /** What was actually found — quoted back so a finding is reproducible. */
  detail: string;
  /** Contribution to the composite score. 0 excludes it from scoring. */
  weight: number;
}

export interface AeoSignals {
  url: string;
  finalUrl: string;
  ok: boolean;
  httpStatus: number | null;
  fetchMs: number;
  error?: string;

  title: string | null;
  metaDescription: string | null;
  ogType: string | null;
  ogSiteName: string | null;
  canonical: string | null;

  jsonLdBlocks: number;
  jsonLdInvalid: number;
  /** Every @type found across all blocks, flattened through @graph. */
  schemaTypes: string[];
  organization: {
    found: boolean;
    isNewsMedia: boolean;
    name?: string;
    description?: string;
    sameAs: string[];
    knowsAbout: string[];
    hasPublishingPrinciples: boolean;
  };
  article: {
    found: boolean;
    typedAsNews: boolean;
    hasAuthor: boolean;
    authorIsEntity: boolean;
    hasDatePublished: boolean;
    declaresPaywall: boolean;
    hasAbout: boolean;
  };

  feeds: string[];
  visibleWords: number;
  scriptTextRatio: number;

  robots: { exists: boolean; blocksAiCrawlers: string[]; declaresSitemap: boolean };
  sitemapExists: boolean;
  llmsTxtExists: boolean;

  checks: SignalCheck[];
  score: number;
}

/** AI crawler user-agents worth reporting a block on. */
const AI_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'meta-externalagent',
];

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 3_000_000;

/**
 * Only ever fetch public http(s) origins.
 *
 * This surface takes a URL from the client and fetches it server-side, which
 * is a server-side request forgery primitive if left open — more so while
 * PROBATIO_DEMO_MODE bypasses auth. Hostnames that resolve to the loopback,
 * link-local, or RFC1918 ranges are refused here by literal form. This is not
 * a complete SSRF defense (a public hostname can still resolve to a private
 * address, which would need resolution-time checks), so keep this surface
 * behind auth in production.
 */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`Not a valid URL: "${raw}"`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Only http(s) URLs can be audited — got "${url.protocol}"`);
  }
  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) throw new Error(`Refusing to audit a private address: ${host}`);
  return url;
}

async function fetchText(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number | null; text: string; finalUrl: string; ms: number; error?: string }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        // Identify honestly. A crawler-shaped UA would get crawler-shaped
        // treatment, and we want to see the page a reader's engine would get.
        'User-Agent': 'KneadProbatioAudit/1.0 (+https://kneadmag.com; AEO benchmark)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5',
        ...(init.headers ?? {}),
      },
    });
    const raw = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      text: raw.length > MAX_BYTES ? raw.slice(0, MAX_BYTES) : raw,
      finalUrl: res.url || url,
      ms: Date.now() - started,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: null,
      text: '',
      finalUrl: url,
      ms: Date.now() - started,
      error: err?.name === 'AbortError' ? `Timed out after ${FETCH_TIMEOUT_MS}ms` : err?.message ?? 'fetch failed',
    };
  }
}

// ─── HTML helpers ────────────────────────────────────────────────────────────

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/** Text a readability-style extractor would keep: no scripts, styles, or tags. */
function extractVisibleText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Total characters living inside <script> bodies. */
function scriptTextLength(html: string): number {
  let total = 0;
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) total += m[1].length;
  return total;
}

function countWords(text: string): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

// ─── JSON-LD ─────────────────────────────────────────────────────────────────

interface LdScan {
  blocks: number;
  invalid: number;
  nodes: any[];
}

function scanJsonLd(html: string): LdScan {
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out: LdScan = { blocks: 0, invalid: 0, nodes: [] };
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.blocks++;
    try {
      const parsed = JSON.parse(m[1].trim());
      for (const node of flattenGraph(parsed)) out.nodes.push(node);
    } catch {
      out.invalid++;
    }
  }
  return out;
}

/** Walk @graph and arrays so every node is reachable at the top level. */
function flattenGraph(input: any): any[] {
  const out: any[] = [];
  const visit = (value: any, depth: number) => {
    if (!value || typeof value !== 'object' || depth > 6) return;
    if (Array.isArray(value)) {
      value.forEach((v) => visit(v, depth + 1));
      return;
    }
    out.push(value);
    if (Array.isArray(value['@graph'])) value['@graph'].forEach((v: any) => visit(v, depth + 1));
  };
  visit(input, 0);
  return out;
}

function typesOf(node: any): string[] {
  const t = node?.['@type'];
  if (!t) return [];
  return (Array.isArray(t) ? t : [t]).map((v) => String(v));
}

function asArray(value: any): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => (typeof v === 'string' ? v : v?.name ?? '')).filter(Boolean);
}

const ORG_TYPES = ['Organization', 'NewsMediaOrganization', 'Periodical', 'OnlineBusiness', 'Corporation'];
const NEWS_ORG_TYPES = ['NewsMediaOrganization', 'Periodical'];
const ARTICLE_TYPES = ['Article', 'NewsArticle', 'BlogPosting', 'Report', 'ReportageNewsArticle'];
const NEWS_ARTICLE_TYPES = ['NewsArticle', 'ReportageNewsArticle', 'Report'];

// ─── The audit ───────────────────────────────────────────────────────────────

export async function auditUrl(rawUrl: string): Promise<AeoSignals> {
  const url = assertPublicUrl(rawUrl);
  const origin = url.origin;

  const page = await fetchText(url.toString());

  const base: AeoSignals = {
    url: url.toString(),
    finalUrl: page.finalUrl,
    ok: page.ok,
    httpStatus: page.status,
    fetchMs: page.ms,
    ...(page.error ? { error: page.error } : {}),
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
    robots: { exists: false, blocksAiCrawlers: [], declaresSitemap: false },
    sitemapExists: false,
    llmsTxtExists: false,
    checks: [],
    score: 0,
  };

  if (!page.ok || !page.text) {
    base.checks = [
      {
        id: 'reachable',
        label: 'Page is reachable',
        status: 'fail',
        detail: page.error ?? `HTTP ${page.status ?? '—'}`,
        weight: 1,
      },
    ];
    return base;
  }

  const html = page.text;

  // Head signals
  base.title = metaContent(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]);
  base.metaDescription = metaContent(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
  ]);
  base.ogType = metaContent(html, [/<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']*)["']/i]);
  base.ogSiteName = metaContent(html, [/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i]);
  base.canonical = metaContent(html, [/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i]);

  // Feeds
  const feedRe = /<link[^>]+type=["'](application\/(?:rss\+xml|atom\+xml|feed\+json|json))["'][^>]*>/gi;
  const feedMatches = html.match(feedRe) ?? [];
  base.feeds = feedMatches
    .map((tag) => tag.match(/href=["']([^"']+)["']/i)?.[1])
    .filter((v): v is string => Boolean(v));

  // Text shape
  const visible = extractVisibleText(html);
  base.visibleWords = countWords(visible);
  const scriptChars = scriptTextLength(html);
  const totalText = scriptChars + visible.length;
  base.scriptTextRatio = totalText > 0 ? Number((scriptChars / totalText).toFixed(3)) : 0;

  // JSON-LD
  const ld = scanJsonLd(html);
  base.jsonLdBlocks = ld.blocks;
  base.jsonLdInvalid = ld.invalid;
  base.schemaTypes = Array.from(new Set(ld.nodes.flatMap(typesOf))).sort();

  const orgNode = ld.nodes.find((n) => typesOf(n).some((t) => ORG_TYPES.includes(t)));
  if (orgNode) {
    base.organization = {
      found: true,
      isNewsMedia: typesOf(orgNode).some((t) => NEWS_ORG_TYPES.includes(t)),
      name: typeof orgNode.name === 'string' ? orgNode.name : undefined,
      description: typeof orgNode.description === 'string' ? orgNode.description : undefined,
      sameAs: asArray(orgNode.sameAs),
      knowsAbout: asArray(orgNode.knowsAbout),
      hasPublishingPrinciples: Boolean(orgNode.publishingPrinciples || orgNode.ethicsPolicy || orgNode.masthead),
    };
  }

  const articleNode = ld.nodes.find((n) => typesOf(n).some((t) => ARTICLE_TYPES.includes(t)));
  if (articleNode) {
    const author = articleNode.author;
    const authorNodes = Array.isArray(author) ? author : author ? [author] : [];
    base.article = {
      found: true,
      typedAsNews: typesOf(articleNode).some((t) => NEWS_ARTICLE_TYPES.includes(t)),
      hasAuthor: authorNodes.length > 0,
      // A bare string author is not an entity an engine can accumulate on.
      authorIsEntity: authorNodes.some((a) => typeof a === 'object' && (a['@id'] || a.url || a.sameAs)),
      hasDatePublished: Boolean(articleNode.datePublished),
      declaresPaywall:
        articleNode.isAccessibleForFree === false ||
        articleNode.isAccessibleForFree === 'False' ||
        Boolean(articleNode.hasPart),
      hasAbout: Boolean(articleNode.about),
    };
  }

  // Sibling files
  const [robotsRes, sitemapRes, llmsRes] = await Promise.all([
    fetchText(`${origin}/robots.txt`),
    fetchText(`${origin}/sitemap.xml`),
    fetchText(`${origin}/llms.txt`),
  ]);

  if (robotsRes.ok && robotsRes.text) {
    const txt = robotsRes.text;
    base.robots.exists = true;
    base.robots.declaresSitemap = /^\s*sitemap:/im.test(txt);
    base.robots.blocksAiCrawlers = AI_CRAWLERS.filter((bot) => {
      const block = new RegExp(`user-agent:\\s*${bot}[\\s\\S]*?(?=\\nuser-agent:|$)`, 'i').exec(txt);
      return Boolean(block && /disallow:\s*\/\s*$/im.test(block[0]));
    });
  }
  base.sitemapExists = sitemapRes.ok && /<(urlset|sitemapindex)/i.test(sitemapRes.text);
  base.llmsTxtExists = llmsRes.ok && llmsRes.text.trim().length > 0;

  base.checks = buildChecks(base);
  base.score = scoreOf(base.checks);
  return base;
}

/**
 * The rubric, as deterministic checks.
 *
 * Weights encode what actually moves publisher citation, not what is easiest
 * to measure. Organization typing and a categorical description are weighted
 * highest because they decide whether an engine knows what kind of thing it is
 * reading at all — the failure mode that classifies a magazine as software.
 */
function buildChecks(s: AeoSignals): SignalCheck[] {
  const checks: SignalCheck[] = [];
  const add = (id: string, label: string, status: CheckStatus, detail: string, weight = 1) =>
    checks.push({ id, label, status, detail, weight });

  add('reachable', 'Page is reachable', s.ok ? 'pass' : 'fail', `HTTP ${s.httpStatus ?? '—'} in ${s.fetchMs}ms`, 1);

  // ── Identity ──
  add(
    'org-schema',
    'Publisher declares an Organization',
    s.organization.found ? 'pass' : 'fail',
    s.organization.found
      ? `Found as ${s.schemaTypes.filter((t) => ORG_TYPES.includes(t)).join(', ')}`
      : 'No Organization node in any JSON-LD block',
    3,
  );
  add(
    'news-org-type',
    'Typed as a news/media organization',
    s.organization.isNewsMedia ? 'pass' : s.organization.found ? 'warn' : 'fail',
    s.organization.isNewsMedia
      ? 'NewsMediaOrganization or Periodical'
      : 'Generic Organization only — an engine must infer the category from content',
    3,
  );
  add(
    'categorical-description',
    'Description says what kind of publication this is',
    describesCategory(s) ? 'pass' : 'fail',
    describesCategory(s)
      ? `"${(s.organization.description ?? s.metaDescription ?? '').slice(0, 120)}"`
      : `No category noun found in "${(s.organization.description ?? s.metaDescription ?? '(none)').slice(0, 120)}"`,
    3,
  );
  add(
    'sameas',
    'Organization corroborated with sameAs links',
    s.organization.sameAs.length >= 2 ? 'pass' : s.organization.sameAs.length === 1 ? 'warn' : 'fail',
    s.organization.sameAs.length ? s.organization.sameAs.join(', ') : 'No sameAs profiles declared',
    2,
  );
  add(
    'knows-about',
    'Topical beat declared with knowsAbout',
    s.organization.knowsAbout.length > 0 ? 'pass' : 'fail',
    s.organization.knowsAbout.length ? s.organization.knowsAbout.join(', ') : 'Beat left to be inferred from articles',
    1,
  );
  add(
    'publishing-principles',
    'Editorial standards published',
    s.organization.hasPublishingPrinciples ? 'pass' : 'fail',
    s.organization.hasPublishingPrinciples ? 'publishingPrinciples / ethicsPolicy / masthead present' : 'None declared',
    1,
  );

  // ── Article-level ──
  add(
    'article-schema',
    'Article structured data present',
    s.article.found ? 'pass' : 'na',
    s.article.found ? `Typed as ${s.schemaTypes.filter((t) => ARTICLE_TYPES.includes(t)).join(', ')}` : 'No Article node (expected on a homepage)',
    s.article.found ? 2 : 0,
  );
  add(
    'author-entity',
    'Bylines are resolvable entities',
    // Without an Article node there is no byline to grade — say so rather than
    // reporting a failure the page was never given a chance to pass.
    !s.article.found ? 'na' : s.article.authorIsEntity ? 'pass' : s.article.hasAuthor ? 'warn' : 'fail',
    !s.article.found
      ? 'No Article node on the fetched page — audit an article URL to grade bylines'
      : s.article.authorIsEntity
      ? 'Author carries @id / url / sameAs'
      : s.article.hasAuthor
      ? 'Author present but is a bare string — nothing to accumulate authority on'
      : 'No author declared',
    s.article.found ? 2 : 0,
  );
  add(
    'paywall-declared',
    'Paywall declared to machines',
    s.article.declaresPaywall ? 'pass' : 'na',
    s.article.declaresPaywall
      ? 'isAccessibleForFree / hasPart present'
      : 'No paywall declaration (fine if the page is free)',
    0,
  );

  // ── Retrievability ──
  add(
    'extractable-text',
    'Body text survives extraction',
    s.visibleWords >= 250 ? 'pass' : s.visibleWords >= 80 ? 'warn' : 'fail',
    `${s.visibleWords} words after stripping scripts and tags`,
    2,
  );
  add(
    'script-locked-text',
    'Content is not locked inside scripts',
    s.scriptTextRatio <= 0.6 ? 'pass' : s.scriptTextRatio <= 0.85 ? 'warn' : 'fail',
    `${Math.round(s.scriptTextRatio * 100)}% of page text sits inside <script> — high values mean client-rendered or client-gated prose`,
    2,
  );
  add('sitemap', 'Sitemap published', s.sitemapExists ? 'pass' : 'fail', s.sitemapExists ? 'sitemap.xml served' : 'No sitemap.xml', 1);
  add(
    'robots',
    'robots.txt present',
    s.robots.exists ? 'pass' : 'fail',
    s.robots.exists
      ? `Present${s.robots.declaresSitemap ? ', declares sitemap' : ', no sitemap line'}`
      : 'No robots.txt',
    1,
  );
  add(
    'ai-crawlers-allowed',
    'AI crawlers not blocked',
    s.robots.blocksAiCrawlers.length === 0 ? 'pass' : 'warn',
    s.robots.blocksAiCrawlers.length
      ? `Blocks ${s.robots.blocksAiCrawlers.join(', ')} — a deliberate choice, but it forfeits citation`
      : 'No AI crawler is disallowed',
    1,
  );
  add('feed', 'Feed published', s.feeds.length > 0 ? 'pass' : 'fail', s.feeds.length ? s.feeds.join(', ') : 'No RSS/Atom/JSON feed linked', 1);
  add('llms-txt', 'llms.txt published', s.llmsTxtExists ? 'pass' : 'warn', s.llmsTxtExists ? 'Served' : 'Not served (emerging convention)', 0);

  return checks;
}

/**
 * Does the description name a category, or only evoke a mood?
 *
 * "Nourishment for the creative spirit" is a slogan; "an independent magazine
 * covering art and food" is a category. An engine can place the second and has
 * to guess at the first — which is the whole failure this surface exists to
 * catch.
 */
const CATEGORY_NOUNS = [
  'magazine',
  'publication',
  'journal',
  'newspaper',
  'news',
  'journalism',
  'editorial',
  'review',
  'quarterly',
  'gazette',
  'press',
  'media outlet',
  'reporting',
];

function describesCategory(s: AeoSignals): boolean {
  const text = `${s.organization.description ?? ''} ${s.metaDescription ?? ''}`.toLowerCase();
  return CATEGORY_NOUNS.some((noun) => text.includes(noun));
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

/** One-line-per-check rendering, used as the turn body the judge reads. */
export function renderSignalReport(s: AeoSignals): string {
  const lines: string[] = [];
  lines.push(`${s.finalUrl} — composite score ${s.score}/100`);
  if (s.error) lines.push(`FETCH ERROR: ${s.error}`);
  lines.push('');
  lines.push(`Title: ${s.title ?? '(none)'}`);
  lines.push(`Meta description: ${s.metaDescription ?? '(none)'}`);
  lines.push(`Schema types found: ${s.schemaTypes.length ? s.schemaTypes.join(', ') : '(none)'}`);
  if (s.organization.description) lines.push(`Org description: ${s.organization.description}`);
  lines.push('');
  for (const c of s.checks) {
    lines.push(`[${c.status.toUpperCase().padEnd(4)}] ${c.label} — ${c.detail}`);
  }
  return lines.join('\n');
}
