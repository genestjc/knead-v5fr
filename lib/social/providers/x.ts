/**
 * X — API v2 connector.
 *
 * What you get depends entirely on the access tier of the bearer token, and
 * the connector is written so that the tier shows up as a labelled absence
 * rather than a wrong number:
 *
 *   • public_metrics (likes, reposts, replies, quotes, bookmarks, views) comes
 *     back for any account on any tier that can read timelines. This is the
 *     comparison data, and it is the same fields for us and for competitors —
 *     which makes X the one platform where head-to-head is genuinely
 *     apples-to-apples.
 *   • Replies need /2/tweets/search/recent with a conversation_id filter,
 *     which is gated and also only reaches back seven days. When it is not
 *     available the connector records why and returns the posts anyway; the
 *     sentiment tab then says X contributed no replies instead of implying
 *     the posts drew none.
 *
 * Retweets are excluded from the timeline pull. A retweet carries the original
 * author's engagement, so counting it as ours would credit us with someone
 * else's numbers — and it would do it inconsistently, since an account that
 * retweets heavily would look like it out-performs one that doesn't.
 */
import { getJson, sinceIso } from '../http';
import { MAX_POSTS_PER_ACCOUNT } from '../config';
import { EMPTY_METRICS, type PlatformResult, type SocialAccount, type SocialComment, type SocialPost } from '../types';
import { extractLinks, extractTags, numberOrNull, type ProviderRequest } from './shared';

const API = 'https://api.x.com/2';

/** X caps a timeline request at 100 and rejects anything under 5. */
function clampResults(n: number): number {
  return Math.max(5, Math.min(100, n));
}

export async function fetchX(req: ProviderRequest): Promise<PlatformResult> {
  const started = Date.now();
  const bearer = process.env.X_BEARER_TOKEN?.trim();

  const base: PlatformResult = {
    platform: 'x',
    ok: false,
    configured: Boolean(bearer),
    source: 'none',
    error: null,
    note: null,
    accounts: [],
    posts: [],
    comments: [],
    fetchedMs: 0,
  };

  if (!bearer) {
    return {
      ...base,
      ok: true,
      note: 'X is unconfigured. Set X_BEARER_TOKEN — v2 has no unauthenticated read path.',
      fetchedMs: Date.now() - started,
    };
  }

  const auth = { Authorization: `Bearer ${bearer}` };
  const handles = req.accounts.map((a) => a.handle).slice(0, 20);
  const problems: string[] = [];

  // One lookup covers every handle — the per-request cost here is rate limit,
  // not bytes, so batching the profile read leaves more budget for timelines.
  const lookup = await getJson<any>(
    `${API}/users/by?usernames=${encodeURIComponent(handles.join(','))}&user.fields=public_metrics,name,username`,
    { headers: auth },
  );

  if (!lookup.ok) {
    return {
      ...base,
      ok: false,
      configured: true,
      source: 'api',
      error: lookup.error,
      fetchedMs: Date.now() - started,
    };
  }

  const users: any[] = Array.isArray(lookup.data?.data) ? lookup.data.data : [];
  for (const err of lookup.data?.errors ?? []) {
    problems.push(`@${err?.value ?? '?'}: ${err?.detail ?? 'not found'}`);
  }

  const accounts: SocialAccount[] = [];
  const posts: SocialPost[] = [];
  const comments: SocialComment[] = [];
  let replyLookupNote: string | null = null;

  for (const user of users) {
    const handle = String(user?.username ?? '').toLowerCase();
    const isOurs = req.accounts.some((a) => a.handle.toLowerCase() === handle && a.isOurs);
    const followers = numberOrNull(user?.public_metrics?.followers_count);

    const fields = [
      'created_at',
      'public_metrics',
      'entities',
      'referenced_tweets',
      'note_tweet',
    ].join(',');

    const timeline = await getJson<any>(
      `${API}/users/${user.id}/tweets` +
        `?max_results=${clampResults(MAX_POSTS_PER_ACCOUNT)}` +
        `&start_time=${encodeURIComponent(sinceIso(Math.min(req.windowDays, 7)))}` +
        `&exclude=retweets` +
        `&tweet.fields=${encodeURIComponent(fields)}`,
      { headers: auth },
    );

    if (!timeline.ok) {
      problems.push(`@${handle}: ${timeline.error}`);
      continue;
    }

    const rows: any[] = Array.isArray(timeline.data?.data) ? timeline.data.data : [];
    const accountPosts = rows.map((t) => toPost(t, handle, user?.name ?? null, isOurs, followers));
    posts.push(...accountPosts);

    accounts.push({
      platform: 'x',
      handle,
      displayName: user?.name ?? null,
      url: `https://x.com/${handle}`,
      followers,
      postsInWindow: accountPosts.length,
      isOurs,
    });

    if (req.includeComments && isOurs) {
      const ranked = [...accountPosts]
        .sort((a, b) => (b.metrics.comments ?? 0) - (a.metrics.comments ?? 0))
        .slice(0, 5);
      for (const post of ranked) {
        if ((post.metrics.comments ?? 0) === 0) continue;
        const replies = await getJson<any>(
          `${API}/tweets/search/recent` +
            `?query=${encodeURIComponent(`conversation_id:${post.id}`)}` +
            `&max_results=50&tweet.fields=created_at,public_metrics,author_id` +
            `&expansions=author_id&user.fields=username`,
          { headers: auth },
        );
        if (!replies.ok) {
          // Recorded once, not once per post — a gated endpoint is one fact.
          replyLookupNote ??=
            `Replies could not be read (${replies.error}). /2/tweets/search/recent needs a tier that allows it and only reaches back 7 days, so X contributed post metrics but no reply text.`;
          break;
        }
        const usernames = new Map<string, string>(
          (replies.data?.includes?.users ?? []).map((u: any) => [String(u.id), String(u.username ?? '')]),
        );
        for (const r of replies.data?.data ?? []) {
          if (String(r.id) === post.id) continue;
          comments.push({
            platform: 'x',
            id: String(r.id),
            postId: post.id,
            authorHandle: (usernames.get(String(r.author_id)) ?? '').toLowerCase(),
            text: String(r?.text ?? ''),
            publishedAt: r?.created_at ? new Date(r.created_at).toISOString() : null,
            likes: numberOrNull(r?.public_metrics?.like_count),
          });
        }
      }
    }
  }

  const notes = [
    req.windowDays > 7
      ? `The user-timeline endpoint reaches back 7 days on standard access, so this pull covers 7 days rather than the ${req.windowDays} requested.`
      : null,
    replyLookupNote,
  ].filter(Boolean);

  return {
    ...base,
    ok: posts.length > 0 || problems.length === 0,
    configured: true,
    source: 'api',
    error: problems.length ? problems.join(' · ') : null,
    note: notes.length ? notes.join(' ') : null,
    accounts,
    posts,
    comments,
    fetchedMs: Date.now() - started,
  };
}

function toPost(
  t: any,
  handle: string,
  name: string | null,
  isOurs: boolean,
  followers: number | null,
): SocialPost {
  // note_tweet carries the full text of a long post; `text` is truncated for
  // those. Reading only `text` would hand the analysis layer a cut-off
  // sentence and let it conclude the post was thin.
  const text = String(t?.note_tweet?.text ?? t?.text ?? '');
  const metrics = t?.public_metrics ?? {};
  const urls: string[] = (t?.entities?.urls ?? [])
    .map((u: any) => String(u?.expanded_url ?? u?.url ?? ''))
    .filter(Boolean);

  const isReply = (t?.referenced_tweets ?? []).some((r: any) => r?.type === 'replied_to');
  const isQuote = (t?.referenced_tweets ?? []).some((r: any) => r?.type === 'quoted');

  return {
    platform: 'x',
    id: String(t.id),
    url: `https://x.com/${handle}/status/${t.id}`,
    authorHandle: handle,
    authorName: name,
    isOurs,
    text,
    mediaType: urls.length > 0 ? 'link' : isQuote || isReply ? 'text' : 'text',
    publishedAt: t?.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
    authorFollowers: followers,
    tags: [
      ...new Set([
        ...((t?.entities?.hashtags ?? []).map((h: any) => String(h?.tag ?? '').toLowerCase())),
        ...extractTags(text),
      ]),
    ].filter(Boolean),
    links: urls.length ? [...new Set(urls)] : extractLinks(text),
    metrics: {
      ...EMPTY_METRICS,
      likes: numberOrNull(metrics.like_count),
      comments: numberOrNull(metrics.reply_count),
      reposts: numberOrNull(metrics.retweet_count),
      quotes: numberOrNull(metrics.quote_count),
      saves: numberOrNull(metrics.bookmark_count),
      views: numberOrNull(metrics.impression_count),
    },
  };
}
