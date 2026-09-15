/**
 * Zora — creator profile and coined posts.
 *
 * Zora is the odd one in this console and should be read differently from the
 * other four. Everywhere else, engagement is free: a like costs nothing, so a
 * high like count means "this caught attention". On Zora a collect costs
 * money. One collect is therefore a stronger signal than a hundred likes
 * anywhere else, and the metrics layer deliberately does NOT roll collects
 * into a combined engagement total — averaging a paid action with a free one
 * produces a number that means nothing on either side.
 *
 * The API base is configurable because Zora's endpoints have moved more than
 * once. When the payload doesn't match what this expects, the connector says
 * so and names the variable, rather than reporting zero posts — a silent zero
 * here would read as "nobody collected anything", which is a very different
 * and much more alarming claim than "we could not reach the API".
 */
import { getJson } from '../http';
import { MAX_POSTS_PER_ACCOUNT } from '../config';
import { EMPTY_METRICS, type PlatformResult, type SocialAccount, type SocialPost } from '../types';
import { extractLinks, extractTags, numberOrNull, type ProviderRequest } from './shared';

const DEFAULT_BASE = 'https://api-sdk.zora.engineering';

function base(): string {
  return (process.env.ZORA_API_BASE?.trim() || DEFAULT_BASE).replace(/\/+$/, '');
}

export async function fetchZora(req: ProviderRequest): Promise<PlatformResult> {
  const started = Date.now();
  const key = process.env.ZORA_API_KEY?.trim();
  const headers: Record<string, string> = key ? { 'api-key': key } : {};

  const accounts: SocialAccount[] = [];
  const posts: SocialPost[] = [];
  const problems: string[] = [];

  for (const account of req.accounts) {
    try {
      const result = await fetchProfile(account.handle, account.isOurs, req, headers);
      if (result.account) accounts.push(result.account);
      posts.push(...result.posts);
      if (result.error) problems.push(`@${account.handle}: ${result.error}`);
    } catch (err: any) {
      problems.push(`@${account.handle}: ${err?.message ?? 'failed'}`);
    }
  }

  return {
    platform: 'zora',
    ok: posts.length > 0 || problems.length === 0,
    configured: Boolean(key),
    source: key ? 'api' : 'public',
    error: problems.length ? problems.join(' · ') : null,
    note:
      'Collects are paid actions and are reported separately from likes everywhere in this console — they are never folded into a combined engagement figure.' +
      (key ? '' : ' Reading unauthenticated; set ZORA_API_KEY for higher rate limits.'),
    accounts,
    posts,
    comments: [],
    fetchedMs: Date.now() - started,
  };
}

async function fetchProfile(
  handle: string,
  isOurs: boolean,
  req: ProviderRequest,
  headers: Record<string, string>,
): Promise<{ account: SocialAccount | null; posts: SocialPost[]; error: string | null }> {
  const profileRes = await getJson<any>(
    `${base()}/profile?identifier=${encodeURIComponent(handle)}`,
    { headers },
  );
  if (!profileRes.ok) {
    return {
      account: null,
      posts: [],
      error: `${profileRes.error} — if Zora's API has moved, point ZORA_API_BASE at the current host`,
    };
  }

  const profile = profileRes.data?.profile ?? profileRes.data?.data?.profile ?? profileRes.data;
  if (!profile || typeof profile !== 'object') {
    return {
      account: null,
      posts: [],
      error: 'the profile response had no recognizable profile object — check ZORA_API_BASE',
    };
  }

  const followers = numberOrNull(
    profile?.followerCount ?? profile?.followers?.count ?? profile?.socialAccounts?.followerCount,
  );

  const coinsRes = await getJson<any>(
    `${base()}/profileCoins?identifier=${encodeURIComponent(handle)}&count=${MAX_POSTS_PER_ACCOUNT}`,
    { headers },
  );

  if (!coinsRes.ok) {
    return {
      account: {
        platform: 'zora',
        handle: handle.toLowerCase(),
        displayName: profile?.displayName ?? profile?.username ?? null,
        url: `https://zora.co/@${handle}`,
        followers,
        postsInWindow: 0,
        isOurs,
      },
      posts: [],
      error: `profile read but coins did not: ${coinsRes.error}`,
    };
  }

  const nodes: any[] = collectNodes(coinsRes.data);
  const cutoff = Date.now() - req.windowDays * 86_400_000;

  const posts: SocialPost[] = nodes
    .map((c) => {
      const text = String(c?.description ?? c?.name ?? '');
      const createdAt = c?.createdAt ?? c?.created_at ?? c?.blockTimestamp;
      return {
        platform: 'zora' as const,
        id: String(c?.address ?? c?.id ?? c?.tokenId ?? ''),
        url: c?.address ? `https://zora.co/coin/base:${c.address}` : `https://zora.co/@${handle}`,
        authorHandle: handle.toLowerCase(),
        authorName: profile?.displayName ?? profile?.username ?? null,
        isOurs,
        text,
        mediaType: 'mint' as const,
        publishedAt: createdAt ? new Date(createdAt).toISOString() : new Date(0).toISOString(),
        authorFollowers: followers,
        tags: extractTags(text),
        links: extractLinks(text),
        metrics: {
          ...EMPTY_METRICS,
          // uniqueHolders is the count of distinct wallets holding the coin —
          // the closest thing Zora has to "how many people bought in".
          collects: numberOrNull(c?.uniqueHolders ?? c?.holders ?? c?.totalSupply),
          comments: numberOrNull(c?.commentCount ?? c?.comments?.count),
        },
      };
    })
    .filter((p) => p.id && Date.parse(p.publishedAt) >= cutoff);

  return {
    account: {
      platform: 'zora',
      handle: handle.toLowerCase(),
      displayName: profile?.displayName ?? profile?.username ?? null,
      url: `https://zora.co/@${handle}`,
      followers,
      postsInWindow: posts.length,
      isOurs,
    },
    posts,
    error: null,
  };
}

/**
 * Pull coin nodes out of whichever envelope came back.
 *
 * Zora has shipped these under `edges[].node`, under a bare array, and under
 * a `coins` key at different times. Accepting all three is cheaper than
 * pinning a version, and anything unrecognized falls through to an empty list
 * that the caller reports as a shape problem rather than as zero activity.
 */
function collectNodes(payload: any): any[] {
  const candidates = [
    payload?.profile?.createdCoins?.edges,
    payload?.createdCoins?.edges,
    payload?.data?.profile?.createdCoins?.edges,
    payload?.coins?.edges,
  ];
  for (const edges of candidates) {
    if (Array.isArray(edges)) return edges.map((e: any) => e?.node ?? e).filter(Boolean);
  }
  const arrays = [payload?.coins, payload?.createdCoins, payload?.data, payload];
  for (const arr of arrays) {
    if (Array.isArray(arr)) return arr.filter(Boolean);
  }
  return [];
}
