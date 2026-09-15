/**
 * Instagram — Graph API connector.
 *
 * Two different endpoints do the two halves of the job, and conflating them is
 * the mistake worth avoiding:
 *
 *   • OUR account reads through /{ig-user-id}/media, which is the only path
 *     that returns insights — saves and reach. Those are the numbers that
 *     actually explain Instagram reach, and they exist for the authenticated
 *     account only.
 *   • COMPETITORS read through business_discovery, Instagram's supported way
 *     to see another business account. It returns follower count, captions,
 *     likes and comment counts. It does NOT return saves, reach, or comment
 *     text, and no amount of asking changes that.
 *
 * So a competitor's saves are null, not zero, and the console says the field
 * is unavailable rather than showing a 0 that reads as "nobody saved it".
 * Comment TEXT — what the sentiment agent needs — is ours-only for the same
 * reason, which is a real limit on that analysis, not a bug to route around.
 */
import { getJson } from '../http';
import { MAX_COMMENTS_PER_POST, MAX_POSTS_PER_ACCOUNT } from '../config';
import {
  EMPTY_METRICS,
  type MediaType,
  type PlatformResult,
  type SocialAccount,
  type SocialComment,
  type SocialPost,
} from '../types';
import { extractLinks, extractTags, numberOrNull, type ProviderRequest } from './shared';

const API = 'https://graph.facebook.com/v21.0';

function mediaType(raw: string | undefined): MediaType {
  switch ((raw ?? '').toUpperCase()) {
    case 'IMAGE':
      return 'image';
    case 'VIDEO':
      return 'video';
    case 'CAROUSEL_ALBUM':
      return 'carousel';
    default:
      return 'unknown';
  }
}

export async function fetchInstagram(req: ProviderRequest): Promise<PlatformResult> {
  const started = Date.now();
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();

  const base: PlatformResult = {
    platform: 'instagram',
    ok: false,
    configured: Boolean(token && igUserId),
    source: 'none',
    error: null,
    note: null,
    accounts: [],
    posts: [],
    comments: [],
    fetchedMs: 0,
  };

  if (!token || !igUserId) {
    return {
      ...base,
      ok: true,
      note: 'Instagram is unconfigured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID — the Graph API has no public read path, so nothing can be collected without them.',
      fetchedMs: Date.now() - started,
    };
  }

  const accounts: SocialAccount[] = [];
  const posts: SocialPost[] = [];
  const comments: SocialComment[] = [];
  const problems: string[] = [];

  for (const account of req.accounts) {
    try {
      if (account.isOurs) {
        const result = await fetchOwnAccount(igUserId, token, req);
        accounts.push(result.account);
        posts.push(...result.posts);
        comments.push(...result.comments);
      } else {
        const result = await fetchViaBusinessDiscovery(igUserId, token, account.handle, req);
        if (result.account) accounts.push(result.account);
        posts.push(...result.posts);
        if (result.error) problems.push(`@${account.handle}: ${result.error}`);
      }
    } catch (err: any) {
      problems.push(`@${account.handle}: ${err?.message ?? 'failed'}`);
    }
  }

  return {
    ...base,
    ok: posts.length > 0 || problems.length === 0,
    source: 'api',
    error: problems.length ? problems.join(' · ') : null,
    note: req.accounts.some((a) => !a.isOurs)
      ? 'Competitor rows come from business_discovery: likes, comments counts and captions only. Saves, reach and comment text are available for our own account alone.'
      : null,
    accounts,
    posts,
    comments,
    fetchedMs: Date.now() - started,
  };
}

async function fetchOwnAccount(
  igUserId: string,
  token: string,
  req: ProviderRequest,
): Promise<{ account: SocialAccount; posts: SocialPost[]; comments: SocialComment[] }> {
  const profile = await getJson<any>(
    `${API}/${igUserId}?fields=username,name,followers_count&access_token=${encodeURIComponent(token)}`,
  );
  if (!profile.ok) throw new Error(profile.error ?? 'profile read failed');

  const handle = String(profile.data?.username ?? '').toLowerCase();
  const followers = numberOrNull(profile.data?.followers_count);

  // insights is requested as a sub-field so one call covers metrics and
  // insights. A media item whose insights are still being computed (the first
  // minutes after posting) simply omits the block; that is null, not zero.
  const fields = [
    'id',
    'caption',
    'media_type',
    'permalink',
    'timestamp',
    'like_count',
    'comments_count',
    'insights.metric(saved,reach,total_interactions)',
  ].join(',');

  const media = await getJson<any>(
    `${API}/${igUserId}/media?fields=${encodeURIComponent(fields)}&limit=${MAX_POSTS_PER_ACCOUNT}&access_token=${encodeURIComponent(token)}`,
  );
  if (!media.ok) throw new Error(media.error ?? 'media read failed');

  const rows: any[] = Array.isArray(media.data?.data) ? media.data.data : [];
  const cutoff = Date.now() - req.windowDays * 86_400_000;
  const recent = rows.filter((m) => Date.parse(m?.timestamp ?? '') >= cutoff);

  const posts: SocialPost[] = recent.map((m) => {
    const caption = String(m?.caption ?? '');
    return {
      platform: 'instagram' as const,
      id: String(m.id),
      url: String(m?.permalink ?? ''),
      authorHandle: handle,
      authorName: profile.data?.name ?? null,
      isOurs: true,
      text: caption,
      mediaType: mediaType(m?.media_type),
      publishedAt: new Date(m?.timestamp ?? Date.now()).toISOString(),
      authorFollowers: followers,
      tags: extractTags(caption),
      links: extractLinks(caption),
      metrics: {
        ...EMPTY_METRICS,
        likes: numberOrNull(m?.like_count),
        comments: numberOrNull(m?.comments_count),
        saves: insightValue(m, 'saved'),
        impressions: insightValue(m, 'reach'),
      },
    };
  });

  const comments: SocialComment[] = [];
  if (req.includeComments) {
    // Only the most-engaged posts are worth reading replies on: the sentiment
    // agent wants the conversations that happened, and a post with two
    // comments contributes noise at the same token cost as one with two
    // hundred.
    const ranked = [...posts]
      .sort((a, b) => (b.metrics.comments ?? 0) - (a.metrics.comments ?? 0))
      .slice(0, 8);
    for (const post of ranked) {
      if ((post.metrics.comments ?? 0) === 0) continue;
      const res = await getJson<any>(
        `${API}/${post.id}/comments?fields=id,text,timestamp,username,like_count&limit=${MAX_COMMENTS_PER_POST}&access_token=${encodeURIComponent(token)}`,
      );
      if (!res.ok) continue;
      for (const c of res.data?.data ?? []) {
        comments.push({
          platform: 'instagram',
          id: String(c.id),
          postId: post.id,
          authorHandle: String(c?.username ?? '').toLowerCase(),
          text: String(c?.text ?? ''),
          publishedAt: c?.timestamp ? new Date(c.timestamp).toISOString() : null,
          likes: numberOrNull(c?.like_count),
        });
      }
    }
  }

  return {
    account: {
      platform: 'instagram',
      handle,
      displayName: profile.data?.name ?? null,
      url: `https://www.instagram.com/${handle}/`,
      followers,
      postsInWindow: posts.length,
      isOurs: true,
    },
    posts,
    comments,
  };
}

async function fetchViaBusinessDiscovery(
  igUserId: string,
  token: string,
  handle: string,
  req: ProviderRequest,
): Promise<{ account: SocialAccount | null; posts: SocialPost[]; error: string | null }> {
  const inner = `followers_count,name,media.limit(${MAX_POSTS_PER_ACCOUNT}){id,caption,media_type,like_count,comments_count,timestamp,permalink}`;
  const field = `business_discovery.username(${handle}){${inner}}`;

  const res = await getJson<any>(
    `${API}/${igUserId}?fields=${encodeURIComponent(field)}&access_token=${encodeURIComponent(token)}`,
  );

  if (!res.ok) {
    // business_discovery fails for personal accounts and for handles that
    // don't exist, with the same generic message. Say which two things it
    // could be rather than leaving a bare Graph error in the UI.
    return {
      account: null,
      posts: [],
      error: `${res.error} (business_discovery only sees public Business/Creator accounts — a personal account or a wrong handle both land here)`,
    };
  }

  const discovery = res.data?.business_discovery;
  if (!discovery) return { account: null, posts: [], error: 'no business_discovery payload returned' };

  const followers = numberOrNull(discovery?.followers_count);
  const cutoff = Date.now() - req.windowDays * 86_400_000;
  const rows: any[] = Array.isArray(discovery?.media?.data) ? discovery.media.data : [];

  const posts: SocialPost[] = rows
    .filter((m) => Date.parse(m?.timestamp ?? '') >= cutoff)
    .map((m) => {
      const caption = String(m?.caption ?? '');
      return {
        platform: 'instagram' as const,
        id: String(m.id),
        url: String(m?.permalink ?? ''),
        authorHandle: handle.toLowerCase(),
        authorName: discovery?.name ?? null,
        isOurs: false,
        text: caption,
        mediaType: mediaType(m?.media_type),
        publishedAt: new Date(m?.timestamp ?? Date.now()).toISOString(),
        authorFollowers: followers,
        tags: extractTags(caption),
        links: extractLinks(caption),
        metrics: {
          ...EMPTY_METRICS,
          likes: numberOrNull(m?.like_count),
          comments: numberOrNull(m?.comments_count),
          // saves / reach are owner-only. Leaving these null is the whole
          // point — see the file header.
        },
      };
    });

  return {
    account: {
      platform: 'instagram',
      handle: handle.toLowerCase(),
      displayName: discovery?.name ?? null,
      url: `https://www.instagram.com/${handle}/`,
      followers,
      postsInWindow: posts.length,
      isOurs: false,
    },
    posts,
    error: null,
  };
}

function insightValue(media: any, name: string): number | null {
  const rows: any[] = media?.insights?.data;
  if (!Array.isArray(rows)) return null;
  const row = rows.find((r) => r?.name === name);
  return numberOrNull(row?.values?.[0]?.value);
}
