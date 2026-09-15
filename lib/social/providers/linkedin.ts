/**
 * LinkedIn — organization posts via the versioned REST API.
 *
 * The limit here is structural and worth stating plainly rather than working
 * around: LinkedIn has no supported way to read ANOTHER organization's posts.
 * The Community Management API scopes every read to pages the token
 * administers. So on this platform the console can measure us and cannot
 * measure competitors, and it says so instead of leaving an empty panel that
 * looks like the competitors posted nothing.
 *
 * What that means downstream: the head-to-head and trends agents get a
 * LinkedIn row for us only, and are told LinkedIn comparisons rest on manually
 * entered competitor posts. An agent that doesn't know a platform is one-sided
 * will happily report that we dominate LinkedIn, which would be an artifact of
 * the API's permissions and nothing else.
 */
import { getJson } from '../http';
import { MAX_COMMENTS_PER_POST, MAX_POSTS_PER_ACCOUNT } from '../config';
import { EMPTY_METRICS, type PlatformResult, type SocialComment, type SocialPost } from '../types';
import { extractLinks, extractTags, numberOrNull, type ProviderRequest } from './shared';

const API = 'https://api.linkedin.com/rest';
/** LinkedIn requires an explicit API version month on every REST call. */
const VERSION = process.env.LINKEDIN_API_VERSION?.trim() || '202506';

export async function fetchLinkedIn(req: ProviderRequest): Promise<PlatformResult> {
  const started = Date.now();
  const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  const orgUrn = process.env.LINKEDIN_ORGANIZATION_URN?.trim();

  const competitorNote =
    req.accounts.some((a) => !a.isOurs)
      ? ' Competitor pages cannot be read: LinkedIn scopes post reads to organizations the token administers. Paste their posts into Head to Head to compare on this platform.'
      : '';

  const base: PlatformResult = {
    platform: 'linkedin',
    ok: false,
    configured: Boolean(token && orgUrn),
    source: 'none',
    error: null,
    note: null,
    accounts: [],
    posts: [],
    comments: [],
    fetchedMs: 0,
  };

  if (!token || !orgUrn) {
    return {
      ...base,
      ok: true,
      note:
        'LinkedIn is unconfigured. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_ORGANIZATION_URN (urn:li:organization:NNNN).' +
        competitorNote,
      fetchedMs: Date.now() - started,
    };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  };

  const orgHandle = (process.env.KNEAD_LINKEDIN_SLUG?.trim() || 'knead').toLowerCase();

  const postsRes = await getJson<any>(
    `${API}/posts?author=${encodeURIComponent(orgUrn)}&q=author&count=${MAX_POSTS_PER_ACCOUNT}&sortBy=LAST_MODIFIED`,
    { headers },
  );

  if (!postsRes.ok) {
    return {
      ...base,
      configured: true,
      source: 'api',
      error: postsRes.error,
      note: competitorNote.trim() || null,
      fetchedMs: Date.now() - started,
    };
  }

  const cutoff = Date.now() - req.windowDays * 86_400_000;
  const rows: any[] = Array.isArray(postsRes.data?.elements) ? postsRes.data.elements : [];

  const posts: SocialPost[] = [];
  const comments: SocialComment[] = [];

  for (const row of rows) {
    const createdAt = numberOrNull(row?.createdAt ?? row?.firstPublishedAt);
    if (createdAt === null || createdAt < cutoff) continue;

    const urn = String(row?.id ?? '');
    const text = String(row?.commentary ?? row?.content?.article?.title ?? '');

    // Engagement lives on a separate resource, one call per post. Posts are
    // low-volume on this platform, so this stays bounded without ranking.
    const social = await getJson<any>(
      `${API}/socialActions/${encodeURIComponent(urn)}`,
      { headers },
    );

    posts.push({
      platform: 'linkedin',
      id: urn,
      url: `https://www.linkedin.com/feed/update/${urn}`,
      authorHandle: orgHandle,
      authorName: null,
      isOurs: true,
      text,
      mediaType: row?.content?.article ? 'link' : row?.content?.media ? 'image' : 'text',
      publishedAt: new Date(createdAt).toISOString(),
      authorFollowers: null,
      tags: extractTags(text),
      links: extractLinks(text),
      metrics: {
        ...EMPTY_METRICS,
        likes: social.ok ? numberOrNull(social.data?.likesSummary?.totalLikes) : null,
        comments: social.ok
          ? numberOrNull(social.data?.commentsSummary?.totalFirstLevelComments)
          : null,
      },
    });

    if (req.includeComments && social.ok) {
      const res = await getJson<any>(
        `${API}/socialActions/${encodeURIComponent(urn)}/comments?count=${MAX_COMMENTS_PER_POST}`,
        { headers },
      );
      if (res.ok) {
        for (const c of res.data?.elements ?? []) {
          comments.push({
            platform: 'linkedin',
            id: String(c?.id ?? ''),
            postId: urn,
            // LinkedIn returns an actor URN, not a handle. Carrying the URN is
            // honest; inventing a display name from it would not be.
            authorHandle: String(c?.actor ?? '').replace('urn:li:person:', 'person:'),
            text: String(c?.message?.text ?? ''),
            publishedAt: c?.created?.time ? new Date(c.created.time).toISOString() : null,
            likes: null,
          });
        }
      }
    }
  }

  const followers = await fetchFollowerCount(orgUrn, headers);

  return {
    ...base,
    ok: true,
    configured: true,
    source: 'api',
    note:
      ('Our page only — LinkedIn does not expose other organizations’ posts to the API.' +
        competitorNote).trim(),
    accounts: [
      {
        platform: 'linkedin',
        handle: orgHandle,
        displayName: null,
        url: `https://www.linkedin.com/company/${orgHandle}`,
        followers,
        postsInWindow: posts.length,
        isOurs: true,
      },
    ],
    posts: posts.map((p) => ({ ...p, authorFollowers: followers })),
    comments,
    fetchedMs: Date.now() - started,
  };
}

/** Follower count is its own resource. A failure here costs a rate, not a run. */
async function fetchFollowerCount(
  orgUrn: string,
  headers: Record<string, string>,
): Promise<number | null> {
  const res = await getJson<any>(
    `${API}/networkSizes/${encodeURIComponent(orgUrn)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`,
    { headers },
  );
  return res.ok ? numberOrNull(res.data?.firstDegreeSize) : null;
}
