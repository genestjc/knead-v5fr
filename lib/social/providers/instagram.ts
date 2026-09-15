/**
 * Instagram — two login paths, picked from whichever credentials are present.
 *
 * Meta ships two different Instagram APIs, and which one you can use is
 * decided by something outside this code: whether there is a Facebook Page.
 *
 *   FACEBOOK LOGIN (graph.facebook.com) — needs a Professional account linked
 *   to a Facebook Page. Reads our media with insights, AND reads competitors
 *   through business_discovery. Used when INSTAGRAM_BUSINESS_ACCOUNT_ID is set.
 *
 *   INSTAGRAM LOGIN (graph.instagram.com) — needs no Facebook Page at all.
 *   Reads our own media, insights and comment text through /me. Has NO
 *   business_discovery: competitor data does not exist on this path, at any
 *   price, and cannot be worked around. Used when only the token is set.
 *
 * The connector picks by credential rather than by a mode flag so that adding
 * a Page later is one new environment variable and no code change — competitor
 * rows start appearing on the next pull.
 *
 * What stays true on both paths: insights (saves, reach) and comment text are
 * OURS ONLY. business_discovery, where available, returns follower count,
 * captions, likes and comment counts, and never saves, reach or comment text.
 * So a competitor's saves are null, not zero, and the console says the field is
 * unavailable rather than showing a 0 that reads as "nobody saved it".
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

const FACEBOOK_API = 'https://graph.facebook.com/v21.0';
const INSTAGRAM_API = 'https://graph.instagram.com/v21.0';

/**
 * Which path this environment can take.
 *
 * `business-discovery` is the capability that actually differs, so it is named
 * for that rather than for the login flow — every branch below turns on
 * whether competitors are readable, not on which host is being called.
 */
export type InstagramPath = 'facebook-login' | 'instagram-login';

export function instagramPath(): InstagramPath | null {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!token) return null;
  return process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim() ? 'facebook-login' : 'instagram-login';
}

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
  const path = instagramPath();

  const base: PlatformResult = {
    platform: 'instagram',
    ok: false,
    configured: path !== null,
    source: 'none',
    error: null,
    note: null,
    accounts: [],
    posts: [],
    comments: [],
    fetchedMs: 0,
  };

  if (!token || path === null) {
    return {
      ...base,
      ok: true,
      note:
        'Instagram is unconfigured. Set INSTAGRAM_ACCESS_TOKEN — neither Instagram API has a public read path, so nothing can be collected without it. ' +
        'Add INSTAGRAM_BUSINESS_ACCOUNT_ID as well if the account is linked to a Facebook Page; that unlocks competitor data through business_discovery.',
      fetchedMs: Date.now() - started,
    };
  }

  const wantsCompetitors = req.accounts.some((a) => !a.isOurs);
  const accounts: SocialAccount[] = [];
  const posts: SocialPost[] = [];
  const comments: SocialComment[] = [];
  const problems: string[] = [];

  for (const account of req.accounts) {
    try {
      if (account.isOurs) {
        const result =
          path === 'facebook-login'
            ? await fetchOwnAccount(FACEBOOK_API, igUserId!, token, req)
            : // Instagram Login has no account id to look up — the token is
              // the account, addressed as /me.
              await fetchOwnAccount(INSTAGRAM_API, 'me', token, req);
        accounts.push(result.account);
        posts.push(...result.posts);
        comments.push(...result.comments);
      } else if (path === 'facebook-login') {
        const result = await fetchViaBusinessDiscovery(igUserId!, token, account.handle, req);
        if (result.account) accounts.push(result.account);
        posts.push(...result.posts);
        if (result.error) problems.push(`@${account.handle}: ${result.error}`);
      }
      // On instagram-login there is no competitor branch at all. Skipped
      // silently per account and reported once in `note` below: repeating
      // "business_discovery is unavailable" per handle would fill the error
      // line with one fact.
    } catch (err: any) {
      problems.push(`@${account.handle}: ${err?.message ?? 'failed'}`);
    }
  }

  return {
    ...base,
    ok: posts.length > 0 || problems.length === 0,
    configured: true,
    source: 'api',
    error: problems.length ? problems.join(' · ') : null,
    note: instagramNote(path, wantsCompetitors),
    accounts,
    posts,
    comments,
    fetchedMs: Date.now() - started,
  };
}

/**
 * What this pull could and could not see, in one sentence.
 *
 * This is the string the agents read in their caveats block, so on the
 * Instagram-Login path it has to be unambiguous that competitor absence is a
 * property of the API and not of the competitors.
 */
function instagramNote(path: InstagramPath, wantsCompetitors: boolean): string | null {
  if (path === 'instagram-login') {
    return (
      'Read through Instagram Login (no Facebook Page): OUR ACCOUNT ONLY. ' +
      (wantsCompetitors
        ? 'Competitors on the roster were NOT collected — business_discovery does not exist on this path, so their absence here says nothing about their activity. '
        : '') +
      'Do not describe us as leading or lagging on Instagram. Link a Facebook Page and set INSTAGRAM_BUSINESS_ACCOUNT_ID to add competitor data.'
    );
  }
  return wantsCompetitors
    ? 'Competitor rows come from business_discovery: likes, comment counts and captions only. Saves, reach and comment text are available for our own account alone.'
    : null;
}

/**
 * Our own account, on either path.
 *
 * The two differ only in the host and the node: Facebook Login addresses the
 * account by its id, Instagram Login addresses it as `me`. Everything past
 * that — the media fields, the insights sub-query, the comments edge — is the
 * same call, which is why this is one function and not two.
 *
 * `name` is requested on the Facebook path only. It is not a field on the
 * Instagram Login user node, and asking for it there fails the whole profile
 * read rather than being ignored.
 */
async function fetchOwnAccount(
  api: string,
  node: string,
  token: string,
  req: ProviderRequest,
): Promise<{ account: SocialAccount; posts: SocialPost[]; comments: SocialComment[] }> {
  const profileFields =
    api === FACEBOOK_API ? 'username,name,followers_count' : 'username,followers_count';

  const profile = await getJson<any>(
    `${api}/${node}?fields=${profileFields}&access_token=${encodeURIComponent(token)}`,
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
    `${api}/${node}/media?fields=${encodeURIComponent(fields)}&limit=${MAX_POSTS_PER_ACCOUNT}&access_token=${encodeURIComponent(token)}`,
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
        `${api}/${post.id}/comments?fields=id,text,timestamp,username,like_count&limit=${MAX_COMMENTS_PER_POST}&access_token=${encodeURIComponent(token)}`,
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
    // Facebook Login only — business_discovery is not exposed on
    // graph.instagram.com, which is why this branch is unreachable there.
    `${FACEBOOK_API}/${igUserId}?fields=${encodeURIComponent(field)}&access_token=${encodeURIComponent(token)}`,
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
