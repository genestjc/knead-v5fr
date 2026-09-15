/**
 * Farcaster — Neynar when a key is present, the public Warpcast API when not.
 *
 * Farcaster is the one platform in this console where competitor data is as
 * complete as our own, because the protocol is public: likes, recasts and the
 * full reply thread are readable for any account without permission from
 * anyone. That makes it the most honest head-to-head surface we have, and it
 * is worth weighting accordingly when the numbers disagree with Instagram's.
 *
 * Neynar is preferred when NEYNAR_API_KEY is set — it is the supported,
 * rate-limited path and returns richer reply threads. The public fallback
 * keeps the platform working out of the box, which matters because the free
 * path is the only one most environments will ever have.
 */
import { getJson } from '../http';
import { MAX_COMMENTS_PER_POST, MAX_POSTS_PER_ACCOUNT } from '../config';
import { EMPTY_METRICS, type PlatformResult, type SocialAccount, type SocialComment, type SocialPost } from '../types';
import { extractLinks, extractTags, numberOrNull, type ProviderRequest } from './shared';

const NEYNAR = 'https://api.neynar.com/v2/farcaster';
const WARPCAST = 'https://api.warpcast.com/v2';

export async function fetchFarcaster(req: ProviderRequest): Promise<PlatformResult> {
  const started = Date.now();
  const key = process.env.NEYNAR_API_KEY?.trim();
  const useNeynar = Boolean(key);

  const accounts: SocialAccount[] = [];
  const posts: SocialPost[] = [];
  const comments: SocialComment[] = [];
  const problems: string[] = [];

  for (const account of req.accounts) {
    try {
      const result = useNeynar
        ? await viaNeynar(key!, account.handle, account.isOurs, req)
        : await viaWarpcast(account.handle, account.isOurs, req);
      if (result.account) accounts.push(result.account);
      posts.push(...result.posts);
      comments.push(...result.comments);
      if (result.error) problems.push(`@${account.handle}: ${result.error}`);
    } catch (err: any) {
      problems.push(`@${account.handle}: ${err?.message ?? 'failed'}`);
    }
  }

  return {
    platform: 'farcaster',
    ok: posts.length > 0 || problems.length === 0,
    configured: useNeynar,
    source: useNeynar ? 'api' : 'public',
    error: problems.length ? problems.join(' · ') : null,
    note: useNeynar
      ? null
      : 'Read through the public Warpcast API — no key needed, but it is unsupported and rate limited. Set NEYNAR_API_KEY for the supported path and deeper reply threads.',
    accounts,
    posts,
    comments,
    fetchedMs: Date.now() - started,
  };
}

interface AccountFetch {
  account: SocialAccount | null;
  posts: SocialPost[];
  comments: SocialComment[];
  error: string | null;
}

async function viaNeynar(
  key: string,
  handle: string,
  isOurs: boolean,
  req: ProviderRequest,
): Promise<AccountFetch> {
  const headers = { 'x-api-key': key, api_key: key };

  const user = await getJson<any>(
    `${NEYNAR}/user/by_username?username=${encodeURIComponent(handle)}`,
    { headers },
  );
  if (!user.ok) return { account: null, posts: [], comments: [], error: user.error };

  const profile = user.data?.user ?? user.data?.result?.user;
  const fid = profile?.fid;
  if (!fid) return { account: null, posts: [], comments: [], error: 'no fid in response' };

  const followers = numberOrNull(profile?.follower_count);

  const feed = await getJson<any>(
    `${NEYNAR}/feed/user/casts?fid=${fid}&limit=${MAX_POSTS_PER_ACCOUNT}&include_replies=false`,
    { headers },
  );
  if (!feed.ok) return { account: null, posts: [], comments: [], error: feed.error };

  const cutoff = Date.now() - req.windowDays * 86_400_000;
  const casts: any[] = Array.isArray(feed.data?.casts) ? feed.data.casts : [];

  const posts = casts
    .map((c) => neynarCast(c, handle, profile?.display_name ?? null, isOurs, followers))
    .filter((p) => Date.parse(p.publishedAt) >= cutoff);

  const comments: SocialComment[] = [];
  if (req.includeComments) {
    const ranked = [...posts]
      .sort((a, b) => (b.metrics.comments ?? 0) - (a.metrics.comments ?? 0))
      .slice(0, 8);
    for (const post of ranked) {
      if ((post.metrics.comments ?? 0) === 0) continue;
      const convo = await getJson<any>(
        `${NEYNAR}/cast/conversation?identifier=${encodeURIComponent(post.id)}&type=hash&reply_depth=1&limit=${MAX_COMMENTS_PER_POST}`,
        { headers },
      );
      if (!convo.ok) continue;
      for (const reply of convo.data?.conversation?.cast?.direct_replies ?? []) {
        comments.push({
          platform: 'farcaster',
          id: String(reply?.hash ?? ''),
          postId: post.id,
          authorHandle: String(reply?.author?.username ?? '').toLowerCase(),
          text: String(reply?.text ?? ''),
          publishedAt: reply?.timestamp ? new Date(reply.timestamp).toISOString() : null,
          likes: numberOrNull(reply?.reactions?.likes_count),
        });
      }
    }
  }

  return {
    account: {
      platform: 'farcaster',
      handle: handle.toLowerCase(),
      displayName: profile?.display_name ?? null,
      url: `https://warpcast.com/${handle}`,
      followers,
      postsInWindow: posts.length,
      isOurs,
    },
    posts,
    comments,
    error: null,
  };
}

function neynarCast(
  c: any,
  handle: string,
  name: string | null,
  isOurs: boolean,
  followers: number | null,
): SocialPost {
  const text = String(c?.text ?? '');
  const embedUrls: string[] = (c?.embeds ?? [])
    .map((e: any) => String(e?.url ?? ''))
    .filter(Boolean);
  return {
    platform: 'farcaster',
    id: String(c?.hash ?? ''),
    url: `https://warpcast.com/${handle}/${String(c?.hash ?? '').slice(0, 10)}`,
    authorHandle: handle.toLowerCase(),
    authorName: name,
    isOurs,
    text,
    mediaType: embedUrls.length ? 'link' : 'text',
    publishedAt: c?.timestamp ? new Date(c.timestamp).toISOString() : new Date().toISOString(),
    authorFollowers: followers,
    tags: extractTags(text),
    links: embedUrls.length ? embedUrls : extractLinks(text),
    metrics: {
      ...EMPTY_METRICS,
      likes: numberOrNull(c?.reactions?.likes_count),
      reposts: numberOrNull(c?.reactions?.recasts_count),
      comments: numberOrNull(c?.replies?.count),
    },
  };
}

async function viaWarpcast(
  handle: string,
  isOurs: boolean,
  req: ProviderRequest,
): Promise<AccountFetch> {
  const user = await getJson<any>(
    `${WARPCAST}/user-by-username?username=${encodeURIComponent(handle)}`,
  );
  if (!user.ok) return { account: null, posts: [], comments: [], error: user.error };

  const profile = user.data?.result?.user;
  const fid = profile?.fid;
  if (!fid) return { account: null, posts: [], comments: [], error: 'no fid in response' };

  const followers = numberOrNull(profile?.followerCount);

  const feed = await getJson<any>(`${WARPCAST}/casts?fid=${fid}&limit=${MAX_POSTS_PER_ACCOUNT}`);
  if (!feed.ok) return { account: null, posts: [], comments: [], error: feed.error };

  const cutoff = Date.now() - req.windowDays * 86_400_000;
  const casts: any[] = Array.isArray(feed.data?.result?.casts) ? feed.data.result.casts : [];

  const posts: SocialPost[] = casts
    .map((c) => {
      const text = String(c?.text ?? '');
      // Warpcast timestamps are epoch milliseconds, not the ISO strings
      // Neynar returns. Treating one as the other lands every cast in 1970.
      const ts = typeof c?.timestamp === 'number' ? new Date(c.timestamp) : new Date(c?.timestamp ?? Date.now());
      const hash = String(c?.hash ?? '');
      return {
        platform: 'farcaster' as const,
        id: hash,
        url: `https://warpcast.com/${handle}/${hash.slice(0, 10)}`,
        authorHandle: handle.toLowerCase(),
        authorName: profile?.displayName ?? null,
        isOurs,
        text,
        mediaType: 'text' as const,
        publishedAt: ts.toISOString(),
        authorFollowers: followers,
        tags: extractTags(text),
        links: extractLinks(text),
        metrics: {
          ...EMPTY_METRICS,
          likes: numberOrNull(c?.reactions?.count),
          reposts: numberOrNull(c?.recasts?.count),
          comments: numberOrNull(c?.replies?.count),
        },
      };
    })
    .filter((p) => Date.parse(p.publishedAt) >= cutoff);

  return {
    account: {
      platform: 'farcaster',
      handle: handle.toLowerCase(),
      displayName: profile?.displayName ?? null,
      url: `https://warpcast.com/${handle}`,
      followers,
      postsInWindow: posts.length,
      isOurs,
    },
    posts,
    // The public API has no supported thread endpoint. Returning nothing is
    // correct; the sentiment tab reports Farcaster as contributing no replies
    // rather than pretending the casts drew none.
    comments: [],
    error: null,
  };
}
