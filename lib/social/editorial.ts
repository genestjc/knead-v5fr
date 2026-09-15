/**
 * What the competition is publishing — without a single platform credential.
 *
 * Every social API in this console is gated: Instagram and X have no public
 * read path, LinkedIn won't show another organization's posts at any price.
 * That gate is on the METRICS. It is not on the journalism. What a publication
 * printed, when, and about whom is announced by the publication itself, in a
 * format built to be read by programs.
 *
 * So this module answers the question the metrics were only ever a proxy for:
 * what are they covering that we are not? Two sources, in order of preference:
 *
 *   1. RSS/Atom. Free, unauthenticated, no terms-of-service question — being
 *      machine-read is the format's purpose. Gives headline, date, summary and
 *      the publication's own categories.
 *
 *   2. Tavily web search, for publications with no discoverable feed. Less
 *      precise and it costs an API call, but the key is already in the
 *      environment for Demeter, so it adds no new configuration.
 *
 * Why this matters more than it sounds: coverage and cadence are the two
 * comparisons that DON'T decay with audience size. A 300-follower magazine and
 * a 300,000-follower one can be compared on what they chose to cover and how
 * often, exactly and fairly. Engagement cannot — see lib/social/scale.ts. At a
 * large size gap this is the honest comparison, and it happens to be the free
 * one.
 *
 * What this is NOT: engagement data. Nothing here reports a like, and nothing
 * here should ever be presented next to one as if it were the same kind of
 * fact.
 */
import { webSearch } from '@/lib/ai/web-search';
import { assertPublicUrl } from '@/lib/eval/aeo-signals';
import { getText } from './http';
import { COMMON_FEED_PATHS, discoverFeedUrl, parseFeed, type FeedItem } from './feed-parse';
import type { Competitor } from './types';

export interface EditorialItem extends FeedItem {
  /** Which competitor published it. */
  source: string;
  /** Host it came from, for display. */
  host: string;
}

export type EditorialSourceKind = 'feed' | 'search' | 'none';

export interface EditorialResult {
  source: string;
  kind: EditorialSourceKind;
  feedUrl: string | null;
  /**
   * Set when the stored URL was a page and the real feed was found from it.
   * The caller persists this so the discovery only happens once.
   */
  discoveredFeedUrl?: string;
  items: EditorialItem[];
  error: string | null;
  /** Prose from the search fallback, which does not return structured items. */
  searchNotes: string | null;
}

export interface EditorialSweep {
  results: EditorialResult[];
  windowDays: number;
  /** Everything, flattened and sorted newest first. */
  items: EditorialItem[];
}

const MAX_ITEMS_PER_SOURCE = 25;

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Resolve a competitor to a feed URL.
 *
 * Tries, in order: the URL already stored on the roster, then whatever the
 * site advertises in its <head>, then the handful of conventional paths. The
 * discovered URL is returned so the caller can persist it and skip this dance
 * next time.
 */
export async function resolveFeedUrl(siteUrl: string): Promise<string | null> {
  let base: URL;
  try {
    base = assertPublicUrl(siteUrl);
  } catch {
    return null;
  }

  const page = await getText(base.toString());
  if (page.ok && page.text) {
    const declared = discoverFeedUrl(page.text, base.toString());
    if (declared) return declared;
  }

  for (const path of COMMON_FEED_PATHS) {
    const candidate = new URL(path, base).toString();
    const probe = await getText(candidate);
    // A feed, not a 200-with-HTML — plenty of sites answer /feed with their
    // homepage, and parsing that yields a confident zero items.
    if (probe.ok && looksLikeFeed(probe.text)) return candidate;
  }

  return null;
}

function looksLikeFeed(text: string): boolean {
  const head = text.slice(0, 2_000).toLowerCase();
  return head.includes('<rss') || head.includes('<feed') || head.includes('<rdf:rdf');
}

/**
 * Accept whatever someone pastes into the roster and turn it into a feed URL.
 *
 * Nobody knows their competitors' feed URLs off the top of their head, and
 * making them go and find one is how the field stays empty. A homepage is what
 * people actually have, so a homepage is what this takes: if the URL is
 * already a feed it is used as-is, otherwise the page is asked what it
 * advertises and the conventional paths are probed.
 *
 * Returns why it failed rather than null-and-silence, because "we could not
 * find a feed for this publication" is a thing the person adding it can act on
 * and an empty column is not.
 */
export async function normalizeFeedInput(
  input: string,
): Promise<{ feedUrl: string | null; note: string }> {
  const trimmed = input.trim();
  if (!trimmed) return { feedUrl: null, note: '' };

  let url: URL;
  try {
    url = assertPublicUrl(trimmed);
  } catch (err: any) {
    return { feedUrl: null, note: err?.message ?? 'That is not a valid URL.' };
  }

  const direct = await getText(url.toString());
  if (direct.ok && looksLikeFeed(direct.text)) {
    return { feedUrl: url.toString(), note: 'Feed confirmed.' };
  }

  const discovered = await resolveFeedUrl(url.toString());
  if (discovered) {
    return { feedUrl: discovered, note: `Feed discovered at ${discovered}.` };
  }

  return {
    feedUrl: null,
    note: direct.ok
      ? `No RSS or Atom feed could be found at ${url.host}. The page loaded but advertises none, and the conventional paths returned nothing. Their social handles still work; only coverage tracking needs the feed.`
      : `Could not reach ${url.host}: ${direct.error}`,
  };
}

async function fromFeed(
  source: string,
  feedUrl: string,
  windowDays: number,
): Promise<EditorialResult> {
  const res = await getText(feedUrl);
  if (!res.ok) {
    return { source, kind: 'none', feedUrl, items: [], error: res.error, searchNotes: null };
  }
  if (!looksLikeFeed(res.text)) {
    return {
      source,
      kind: 'none',
      feedUrl,
      items: [],
      error: `${feedUrl} returned HTML rather than a feed — the URL is probably a page, not a feed.`,
      searchNotes: null,
    };
  }

  const parsed = parseFeed(res.text, { maxItems: MAX_ITEMS_PER_SOURCE });
  const cutoff = Date.now() - windowDays * 86_400_000;

  const items: EditorialItem[] = parsed.items
    // An undated entry is kept: plenty of feeds omit dates, and dropping them
    // would silently narrow a publication's output to whatever it timestamps.
    .filter((i) => !i.publishedAt || Date.parse(i.publishedAt) >= cutoff)
    .map((i) => ({ ...i, source, host: hostOf(i.url || feedUrl) }));

  return { source, kind: 'feed', feedUrl, items, error: null, searchNotes: null };
}

/**
 * Search fallback for a publication with no feed.
 *
 * Returns prose rather than items on purpose. Search results are titles and
 * snippets chosen by a relevance ranker, not a publication's own index — and
 * turning them into rows that sit in the same table as real feed entries would
 * dress a guess up as a record. The trends agent is given the prose, labelled.
 */
async function fromSearch(source: string, windowDays: number): Promise<EditorialResult> {
  if (!process.env.TAVILY_API_KEY?.trim()) {
    return {
      source,
      kind: 'none',
      feedUrl: null,
      items: [],
      error:
        'No feed was found and TAVILY_API_KEY is not set, so there is no way to see what this publication is covering. Add a feed URL to the roster, or set the key.',
      searchNotes: null,
    };
  }

  const notes = await webSearch(`${source} recent articles`, {
    maxResults: 8,
    recency: windowDays <= 14 ? 'week' : 'month',
    logTag: 'social54/editorial',
  });

  return { source, kind: 'search', feedUrl: null, items: [], error: null, searchNotes: notes };
}

/**
 * Sweep the roster for what everyone has been publishing.
 *
 * Sources are fetched in series. These are other people's servers being read
 * for our convenience; a burst of parallel requests at a small publication's
 * feed is rude and is also how an IP ends up blocked.
 */
export async function sweepEditorial(
  competitors: Competitor[],
  opts: { windowDays: number; includeSearchFallback?: boolean } = { windowDays: 14 },
): Promise<EditorialSweep> {
  const { windowDays } = opts;
  const results: EditorialResult[] = [];

  for (const competitor of competitors) {
    if (!competitor.isActive) continue;

    try {
      const feedUrl = competitor.feedUrl?.trim() || null;
      if (feedUrl) {
        let result = await fromFeed(competitor.name, feedUrl, windowDays);

        // The stored URL turned out to be a page rather than a feed — which is
        // what a seeded homepage is, and what someone pastes when they haven't
        // gone hunting. Discover the real one and use it, reporting the new URL
        // so the caller can store it and skip this next time.
        if (result.kind === 'none' && result.error) {
          const discovered = await resolveFeedUrl(feedUrl);
          if (discovered && discovered !== feedUrl) {
            const retried = await fromFeed(competitor.name, discovered, windowDays);
            if (retried.kind === 'feed') {
              result = { ...retried, discoveredFeedUrl: discovered };
            }
          }
        }

        results.push(result);
      } else if (opts.includeSearchFallback) {
        results.push(await fromSearch(competitor.name, windowDays));
      } else {
        results.push({
          source: competitor.name,
          kind: 'none',
          feedUrl: null,
          items: [],
          error:
            'No feed URL on the roster. Add one in the Competitors tab — paste their homepage and it will be discovered.',
          searchNotes: null,
        });
      }
    } catch (err: any) {
      results.push({
        source: competitor.name,
        kind: 'none',
        feedUrl: competitor.feedUrl ?? null,
        items: [],
        error: err?.message ?? 'failed',
        searchNotes: null,
      });
    }
  }

  const items = results
    .flatMap((r) => r.items)
    .sort((a, b) => Date.parse(b.publishedAt ?? '0') - Date.parse(a.publishedAt ?? '0'));

  return { results, windowDays, items };
}

/**
 * The editorial block for the trends prompt.
 *
 * Labelled hard as coverage rather than performance. The agent sees engagement
 * numbers elsewhere in the same prompt, and the one thing it must not do is
 * treat a headline count as a popularity signal.
 */
export function renderEditorial(sweep: EditorialSweep): string {
  const withItems = sweep.results.filter((r) => r.items.length > 0);
  const withNotes = sweep.results.filter((r) => r.searchNotes);
  const failed = sweep.results.filter((r) => r.error);

  if (withItems.length === 0 && withNotes.length === 0) {
    return [
      'WHAT THE FIELD PUBLISHED',
      '  Nothing could be collected. This says nothing about what they published —',
      '  it means no feed was reachable. Reasons:',
      ...failed.map((r) => `    • ${r.source}: ${r.error}`),
      '',
    ].join('\n');
  }

  const lines: string[] = [
    `WHAT THE FIELD PUBLISHED — last ${sweep.windowDays} days, from the publications’ own feeds.`,
    '',
    '  This is COVERAGE, not performance. It says what they chose to write about and',
    '  how often. It carries NO engagement information whatsoever — never infer that',
    '  an article did well because it appears here, and never compare these counts to',
    '  a like count. Cadence and subject choice are comparable across any audience',
    '  size gap, which is exactly why they are worth your attention.',
    '',
  ];

  for (const result of withItems) {
    const perWeek = ((result.items.length / sweep.windowDays) * 7).toFixed(1);
    lines.push(`── ${result.source.toUpperCase()} — ${result.items.length} pieces (${perWeek}/wk) ──`);
    for (const item of result.items.slice(0, 15)) {
      lines.push(`   ${item.publishedAt?.slice(0, 10) ?? '(undated)'}  ${item.title}`);
      if (item.categories.length) lines.push(`      categories: ${item.categories.join(', ')}`);
      if (item.summary) lines.push(`      ${item.summary.slice(0, 300)}`);
    }
    lines.push('');
  }

  for (const result of withNotes) {
    lines.push(
      `── ${result.source.toUpperCase()} — no feed; the following came from WEB SEARCH ──`,
      '   Search results are a relevance ranking, not the publication’s own index.',
      '   Treat this as weaker evidence than the feeds above and say so if you cite it.',
      `   ${result.searchNotes?.slice(0, 2_000)}`,
      '',
    );
  }

  if (failed.length) {
    lines.push(
      'SOURCES THAT COULD NOT BE READ (their absence here is not editorial silence):',
      ...failed.map((r) => `   • ${r.source}: ${r.error}`),
      '',
    );
  }

  return lines.join('\n');
}
