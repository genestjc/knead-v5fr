/**
 * Turning five platforms' counters into numbers you can put beside each other.
 *
 * Every function here is pure and every one exists to stop a specific way of
 * lying with social data:
 *
 *   • `engagement()` sums only the fields a post actually reports, and says
 *     which fields it used. A post with likes+comments and a post with
 *     likes+comments+saves+quotes are not comparable totals, and a bare number
 *     hides that. Callers that compare must go through `comparableFields()`.
 *
 *   • `engagementRate()` divides by followers, because absolute engagement
 *     measures audience size and nothing else. A competitor with 40× our
 *     following "wins" every raw comparison while telling us nothing about
 *     whether their post worked.
 *
 *   • `median()` not mean. One post that gets picked up by a large account is
 *     a lottery ticket, and an average built on it reports a typical week that
 *     never happened. The median is what the next post can expect.
 *
 *   • Collects are never folded into engagement. A paid action and a free one
 *     do not belong in the same sum — see lib/social/providers/zora.ts.
 */
import type { SocialMetrics, SocialPlatform, SocialPost } from './types';

/** The free-interaction fields. Collects, views and impressions are excluded. */
export const ENGAGEMENT_FIELDS = ['likes', 'comments', 'reposts', 'quotes', 'saves'] as const;
export type EngagementField = (typeof ENGAGEMENT_FIELDS)[number];

export interface Engagement {
  /** Sum across the fields this post reports. Null when it reports none. */
  total: number | null;
  /** Which fields went into the total — the caveat that travels with it. */
  fields: EngagementField[];
}

export function engagement(metrics: SocialMetrics): Engagement {
  const fields = ENGAGEMENT_FIELDS.filter((f) => typeof metrics[f] === 'number');
  if (fields.length === 0) return { total: null, fields: [] };
  return {
    total: fields.reduce((sum, f) => sum + (metrics[f] as number), 0),
    fields: [...fields],
  };
}

/**
 * Engagement as a share of the author's following, in percent.
 *
 * Null when either half is unknown. A rate computed against a missing follower
 * count would come back as Infinity or as the raw total, and both render as a
 * plausible-looking number in a table.
 */
export function engagementRate(post: SocialPost): number | null {
  const { total } = engagement(post.metrics);
  if (total === null) return null;
  const followers = post.authorFollowers;
  if (!followers || followers <= 0) return null;
  return (total / followers) * 100;
}

/**
 * The metric fields present on EVERY post in a set.
 *
 * This is the gate a fair comparison goes through. Comparing our Instagram
 * post (likes, comments, saves — we own the account) against a competitor's
 * (likes, comments — business_discovery gives no saves) on total engagement
 * hands us a structural advantage worth however many saves we got. Restricted
 * to the intersection, both sides are measured on the same ruler.
 */
export function comparableFields(posts: SocialPost[]): EngagementField[] {
  if (posts.length === 0) return [];
  return ENGAGEMENT_FIELDS.filter((f) =>
    posts.every((p) => typeof p.metrics[f] === 'number'),
  );
}

/** Sum a post over an explicit field list — the comparable-total primitive. */
export function totalOn(post: SocialPost, fields: EngagementField[]): number | null {
  if (fields.length === 0) return null;
  let sum = 0;
  for (const f of fields) {
    const value = post.metrics[f];
    if (typeof value !== 'number') return null;
    sum += value;
  }
  return sum;
}

export function rateOn(post: SocialPost, fields: EngagementField[]): number | null {
  const total = totalOn(post, fields);
  if (total === null) return null;
  if (!post.authorFollowers || post.authorFollowers <= 0) return null;
  return (total / post.authorFollowers) * 100;
}

export function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface AccountSummary {
  platform: SocialPlatform;
  handle: string;
  isOurs: boolean;
  followers: number | null;
  posts: number;
  /** Posts per week over the window — cadence, the most actionable number here. */
  postsPerWeek: number;
  medianEngagement: number | null;
  medianRate: number | null;
  totalCollects: number | null;
  /** Fields the median was built from, so the UI can caveat it. */
  fields: EngagementField[];
}

export function summarizeAccount(
  posts: SocialPost[],
  windowDays: number,
): AccountSummary | null {
  if (posts.length === 0) return null;
  const first = posts[0];
  const fields = comparableFields(posts);

  const totals = posts
    .map((p) => totalOn(p, fields))
    .filter((v): v is number => v !== null);
  const rates = posts
    .map((p) => rateOn(p, fields))
    .filter((v): v is number => v !== null);

  const collectValues = posts
    .map((p) => p.metrics.collects)
    .filter((v): v is number => typeof v === 'number');

  return {
    platform: first.platform,
    handle: first.authorHandle,
    isOurs: first.isOurs,
    // Follower counts are identical across a single account's posts; take the
    // highest seen so a post collected before a partial read still reports it.
    followers: posts.reduce<number | null>(
      (max, p) => (typeof p.authorFollowers === 'number' ? Math.max(max ?? 0, p.authorFollowers) : max),
      null,
    ),
    posts: posts.length,
    postsPerWeek: windowDays > 0 ? Number(((posts.length / windowDays) * 7).toFixed(1)) : 0,
    medianEngagement: median(totals),
    medianRate: rates.length ? Number((median(rates) ?? 0).toFixed(3)) : null,
    totalCollects: collectValues.length ? collectValues.reduce((a, b) => a + b, 0) : null,
    fields,
  };
}

/** Group a flat post list by (platform, handle). */
export function groupByAccount(posts: SocialPost[]): Map<string, SocialPost[]> {
  const groups = new Map<string, SocialPost[]>();
  for (const post of posts) {
    const key = `${post.platform}:${post.authorHandle}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(post);
    else groups.set(key, [post]);
  }
  return groups;
}

/**
 * Rank posts by engagement rate, falling back to raw engagement when the
 * follower count is missing.
 *
 * The fallback is explicit rather than silent: a post ranked on raw count sits
 * in a different unit from one ranked on rate, so `rankedBy` travels with it.
 */
export interface RankedPost {
  post: SocialPost;
  value: number;
  rankedBy: 'rate' | 'total';
}

export function rankPosts(posts: SocialPost[], limit = 10): RankedPost[] {
  const ranked: RankedPost[] = [];
  for (const post of posts) {
    const rate = engagementRate(post);
    if (rate !== null) {
      ranked.push({ post, value: rate, rankedBy: 'rate' });
      continue;
    }
    const { total } = engagement(post.metrics);
    if (total !== null) ranked.push({ post, value: total, rankedBy: 'total' });
  }
  // Rate-ranked posts sort above count-ranked ones: mixing the two scales in a
  // single ordering would put a 2%-rate post below a 40-like post.
  ranked.sort((a, b) => {
    if (a.rankedBy !== b.rankedBy) return a.rankedBy === 'rate' ? -1 : 1;
    return b.value - a.value;
  });
  return ranked.slice(0, limit);
}

/**
 * Split a window in half and report movement.
 *
 * This is what "micro trend" means operationally: what changed between the
 * recent half and the one before it. Anything shorter than two posts a side is
 * reported as insufficient rather than as a percentage, because a single post
 * moving from 40 to 80 engagements is not a 100% upward trend.
 */
export interface Movement {
  recent: number | null;
  previous: number | null;
  /** Percent change, null when either side is missing or too thin to mean anything. */
  changePct: number | null;
  recentCount: number;
  previousCount: number;
  sufficient: boolean;
}

export function movement(posts: SocialPost[], windowDays: number): Movement {
  const half = Date.now() - (windowDays / 2) * 86_400_000;
  const fields = comparableFields(posts);

  const recentPosts = posts.filter((p) => Date.parse(p.publishedAt) >= half);
  const previousPosts = posts.filter((p) => Date.parse(p.publishedAt) < half);

  const value = (subset: SocialPost[]) =>
    median(subset.map((p) => totalOn(p, fields)).filter((v): v is number => v !== null));

  const recent = value(recentPosts);
  const previous = value(previousPosts);
  const sufficient = recentPosts.length >= 2 && previousPosts.length >= 2;

  return {
    recent,
    previous,
    changePct:
      sufficient && recent !== null && previous !== null && previous > 0
        ? Number((((recent - previous) / previous) * 100).toFixed(1))
        : null,
    recentCount: recentPosts.length,
    previousCount: previousPosts.length,
    sufficient,
  };
}

/** Tag frequency across a post set, most-used first. */
export function tagFrequency(posts: SocialPost[], limit = 20): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of new Set(post.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/** A compact number for dense tables: 12400 → 12.4k. */
export function compactNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}
