/**
 * A tolerant RSS/Atom reader, written by hand rather than pulled in.
 *
 * Feeds are the one competitor source that is genuinely open to a program:
 * no token, no login wall, no rate limit worth worrying about, and no terms of
 * service to weigh — being machine-read is the entire point of the format.
 * That makes them the free half of competitor intelligence, and the half that
 * still works at any audience size, because what somebody published does not
 * depend on how many followers they have.
 *
 * No dependency for two reasons. The shape needed here is small — title, link,
 * date, summary — and a strict XML parser is the wrong tool anyway: real feeds
 * in the wild carry unescaped ampersands, stray control characters and
 * mismatched namespaces that make a conforming parser throw on a document a
 * reader would happily display. Everything below degrades to "skip this entry"
 * rather than "lose the feed".
 *
 * Handles RSS 2.0 (<item>), Atom (<entry>) and RDF/RSS 1.0, which still turns
 * up on older publishing stacks.
 */

export interface FeedItem {
  title: string;
  url: string;
  /** ISO string, or null when the feed gave no parseable date. */
  publishedAt: string | null;
  /** Plain-text summary, tags stripped. Empty when the feed carried none. */
  summary: string;
  /** Categories/tags the feed declared. */
  categories: string[];
}

export interface ParsedFeed {
  title: string | null;
  items: FeedItem[];
}

/** Decode the five XML entities plus numeric escapes. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Ampersand last: decoding it first would turn "&amp;lt;" into "<", which
    // is a different string from the one the feed meant.
    .replace(/&amp;/g, '&');
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Strip CDATA wrappers, then markup, then collapse whitespace. */
export function cleanText(raw: string): string {
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const withoutTags = withoutCdata.replace(/<[^>]*>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

/**
 * First matching child element's text.
 *
 * Namespace prefixes are allowed on the tag (`dc:date`, `content:encoded`),
 * because feeds use them inconsistently and requiring the bare name loses the
 * date on a good half of RDF feeds.
 */
function tagText(xml: string, ...names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(
      `<(?:[a-z0-9]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9]+:)?${name}>`,
      'i',
    );
    const match = xml.match(re);
    if (match) {
      const text = cleanText(match[1]);
      if (text) return text;
    }
  }
  return null;
}

/**
 * The entry's link.
 *
 * Atom puts it in an attribute rather than in the element body, and often
 * carries several — an `alternate` pointing at the article and a `self`
 * pointing back at the feed. Taking the first <link> indiscriminately is how a
 * whole feed ends up with every item linking to the feed itself.
 */
function entryLink(xml: string): string | null {
  const alternate = xml.match(
    /<link[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i,
  );
  if (alternate) return decodeEntities(alternate[1]).trim();

  const hrefWithoutRel = xml.match(/<link(?![^>]*\brel=)[^>]*\bhref=["']([^"']+)["']/i);
  if (hrefWithoutRel) return decodeEntities(hrefWithoutRel[1]).trim();

  const body = tagText(xml, 'link');
  if (body && /^https?:\/\//i.test(body)) return body;

  // RSS items sometimes carry only a guid, which is a permalink often enough
  // to be worth using when it looks like one.
  const guid = tagText(xml, 'guid', 'id');
  if (guid && /^https?:\/\//i.test(guid)) return guid;

  return null;
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  // A feed dated in the future is a publishing-system bug, not news. Clamping
  // stops one bad entry sorting above everything real forever.
  const now = Date.now();
  return parsed.getTime() > now + 86_400_000 ? new Date(now).toISOString() : parsed.toISOString();
}

function categories(xml: string): string[] {
  const matches = xml.match(/<(?:[a-z0-9]+:)?category(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-z0-9]+:)?category>/gi) ?? [];
  const fromBody = matches.map((m) => cleanText(m.replace(/<[^>]*>/g, ' ')));
  // Atom declares the category in a term attribute instead.
  const fromAttr = (xml.match(/<category[^>]*\bterm=["']([^"']+)["']/gi) ?? []).map((m) =>
    decodeEntities((m.match(/term=["']([^"']+)["']/i)?.[1] ?? '').trim()),
  );
  return [...new Set([...fromBody, ...fromAttr].filter(Boolean))].slice(0, 12);
}

export function parseFeed(xml: string, opts: { maxItems?: number } = {}): ParsedFeed {
  const maxItems = opts.maxItems ?? 40;
  if (!xml?.trim()) return { title: null, items: [] };

  // Channel title, taken before entries are split out so an item's own <title>
  // cannot be mistaken for the publication's.
  const head = xml.split(/<(?:item|entry)\b/i)[0] ?? '';
  const title = tagText(head, 'title');

  const blocks =
    xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) ?? [];

  const items: FeedItem[] = [];
  for (const block of blocks.slice(0, maxItems)) {
    const url = entryLink(block);
    const itemTitle = tagText(block, 'title');
    // An entry with neither a title nor a link is not an article; skipping it
    // is better than emitting a blank row the agents would have to reason about.
    if (!url && !itemTitle) continue;

    items.push({
      title: itemTitle ?? '(untitled)',
      url: url ?? '',
      publishedAt: parseDate(
        tagText(block, 'pubDate', 'published', 'updated', 'date', 'created'),
      ),
      summary: (tagText(block, 'description', 'summary', 'encoded', 'content') ?? '').slice(0, 1_200),
      categories: categories(block),
    });
  }

  return { title, items };
}

/**
 * Find a feed URL in an HTML page.
 *
 * Saves whoever is editing the competitor roster from hunting for it: they
 * paste the publication's homepage and the feed is discovered from the
 * <link rel="alternate"> the page already advertises.
 */
export function discoverFeedUrl(html: string, baseUrl: string): string | null {
  const links = html.match(/<link[^>]+>/gi) ?? [];
  for (const link of links) {
    if (!/\brel=["'][^"']*alternate/i.test(link)) continue;
    if (!/\btype=["'][^"']*(?:rss|atom)\+xml/i.test(link)) continue;
    const href = link.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      return new URL(decodeEntities(href), baseUrl).toString();
    } catch {
      continue;
    }
  }

  // Nothing advertised. The conventional paths are worth a try by the caller,
  // but this function only reports what the page actually declared.
  return null;
}

/** The paths worth probing when a page advertises no feed. */
export const COMMON_FEED_PATHS = ['/feed', '/feed/', '/rss', '/rss.xml', '/atom.xml', '/index.xml'];
