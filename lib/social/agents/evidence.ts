/**
 * Rendering collected data into the evidence blocks the agents read.
 *
 * Everything an agent claims has to be traceable to a line in one of these
 * blocks, so the rendering has two jobs beyond formatting:
 *
 *  1. Label every absence. A metric the platform doesn't publish renders as
 *     "n/a" with the reason stated once at the top of the block, never as 0.
 *     A model shown `saves: 0` will write "nobody saved it"; shown
 *     `saves: n/a (owner-only on this platform)` it writes nothing, which is
 *     correct.
 *  2. Carry an id. Every post gets a short reference like [IG-3] so an agent
 *     can cite the specific post behind a claim, and the console can link it.
 *
 * Budgets are per-block rather than global. A run that compares six accounts
 * should lose the tail of each evenly instead of spending its whole budget on
 * whichever account happened to be rendered first.
 */
import { compactNumber, engagement, engagementRate } from '../metrics';
import { platformLabel, type SocialComment, type SocialPost } from '../types';

const POST_TEXT_CHARS = 600;
const COMMENT_TEXT_CHARS = 400;

/** Short, stable reference for a post: IG-1, X-4, FC-2… */
export function postRef(post: SocialPost, index: number): string {
  const prefix: Record<string, string> = {
    instagram: 'IG',
    x: 'X',
    farcaster: 'FC',
    zora: 'ZO',
    linkedin: 'LI',
  };
  return `${prefix[post.platform] ?? 'PO'}-${index + 1}`;
}

function metricLine(post: SocialPost): string {
  const parts: string[] = [];
  const m = post.metrics;
  const pairs: [string, number | null][] = [
    ['likes', m.likes],
    ['comments', m.comments],
    ['reposts', m.reposts],
    ['quotes', m.quotes],
    ['saves', m.saves],
    ['views', m.views],
    ['impressions', m.impressions],
    ['collects', m.collects],
  ];
  for (const [name, value] of pairs) {
    parts.push(`${name}:${value === null ? 'n/a' : compactNumber(value)}`);
  }

  const rate = engagementRate(post);
  const { total, fields } = engagement(post.metrics);
  parts.push(`engagement:${total === null ? 'n/a' : compactNumber(total)}`);
  parts.push(`rate:${rate === null ? 'n/a' : `${rate.toFixed(3)}%`}`);
  if (fields.length) parts.push(`(summed over ${fields.join('+')})`);

  return parts.join('  ');
}

export function renderPost(post: SocialPost, ref: string): string {
  const text = post.text.replace(/\s+/g, ' ').trim().slice(0, POST_TEXT_CHARS);
  return [
    `[${ref}] ${post.isOurs ? 'OURS' : 'COMPETITOR'} · ${platformLabel(post.platform)} · @${post.authorHandle} · ${post.publishedAt.slice(0, 10)} · ${post.mediaType}`,
    `      followers:${post.authorFollowers === null ? 'n/a' : compactNumber(post.authorFollowers)}  ${metricLine(post)}`,
    `      ${text || '(no text)'}`,
    post.tags.length ? `      tags: ${post.tags.slice(0, 12).map((t) => `#${t}`).join(' ')}` : '',
    post.links.length ? `      links: ${post.links.slice(0, 3).join(' ')}` : '',
    `      ${post.url}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * A block of posts with a heading.
 *
 * `maxPosts` is applied after sorting by engagement rate, so a truncated block
 * keeps the posts that carry signal rather than the most recent ones.
 */
export function renderPostBlock(
  heading: string,
  posts: SocialPost[],
  opts: { maxPosts?: number; startIndex?: number } = {},
): { text: string; refs: Map<string, SocialPost> } {
  const maxPosts = opts.maxPosts ?? 20;
  const refs = new Map<string, SocialPost>();

  if (posts.length === 0) {
    return { text: `${heading}\n  (no posts in this set)\n`, refs };
  }

  const ordered = [...posts].sort((a, b) => {
    const ar = engagementRate(a);
    const br = engagementRate(b);
    if (ar !== null && br !== null) return br - ar;
    if (ar !== null) return -1;
    if (br !== null) return 1;
    return (engagement(b.metrics).total ?? 0) - (engagement(a.metrics).total ?? 0);
  });

  const shown = ordered.slice(0, maxPosts);
  const lines = shown.map((post, i) => {
    const ref = postRef(post, (opts.startIndex ?? 0) + i);
    refs.set(ref, post);
    return renderPost(post, ref);
  });

  const omitted = ordered.length - shown.length;
  const footer = omitted > 0
    ? `\n  (${omitted} further post${omitted === 1 ? '' : 's'} in this set are not shown — they engaged less than those above, not differently.)`
    : '';

  return { text: `${heading}\n${lines.join('\n\n')}${footer}\n`, refs };
}

/**
 * Replies, grouped under the post they answer.
 *
 * Kept grouped rather than flattened because a reply read without its post is
 * unreadable: "this is exactly what I've been saying" is praise, agreement, or
 * sarcasm depending entirely on what it answers.
 */
export function renderCommentBlock(
  posts: SocialPost[],
  comments: SocialComment[],
  opts: { maxPerPost?: number; maxPosts?: number } = {},
): string {
  const maxPerPost = opts.maxPerPost ?? 12;
  const maxPosts = opts.maxPosts ?? 10;

  const byPost = new Map<string, SocialComment[]>();
  for (const comment of comments) {
    const bucket = byPost.get(comment.postId);
    if (bucket) bucket.push(comment);
    else byPost.set(comment.postId, [comment]);
  }

  if (byPost.size === 0) {
    return 'REPLIES\n  (no reply text was collected — see the collection caveats above; this is not evidence that the posts drew no replies)\n';
  }

  const postsById = new Map(posts.map((p) => [p.id, p]));
  const blocks: string[] = [];

  const ordered = [...byPost.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxPosts);

  for (const [postId, postComments] of ordered) {
    const post = postsById.get(postId);
    const header = post
      ? `IN REPLY TO · ${platformLabel(post.platform)} · @${post.authorHandle} · ${post.publishedAt.slice(0, 10)}\n  POST: ${post.text.replace(/\s+/g, ' ').trim().slice(0, 300)}`
      : `IN REPLY TO post ${postId} (the post itself was not in this pull)`;

    const lines = postComments
      .slice(0, maxPerPost)
      .map(
        (c) =>
          `    @${c.authorHandle || 'unknown'}${c.likes ? ` (${c.likes} likes)` : ''}: ${c.text
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, COMMENT_TEXT_CHARS)}`,
      );

    blocks.push(`${header}\n${lines.join('\n')}`);
  }

  return `REPLIES\n${blocks.join('\n\n')}\n`;
}

/**
 * The caveat block that opens every agent prompt.
 *
 * Rendered as instructions rather than as data, because a model that reads
 * "linkedin: 0 posts" as a fact will draw a conclusion from it, and the thing
 * it needs to know is that it must not.
 */
export function renderCaveats(caveats: string[]): string {
  if (caveats.length === 0) {
    return 'DATA CAVEATS\n  None — every platform in this pull returned data.\n';
  }
  return [
    'DATA CAVEATS — read these before drawing any conclusion from an absence.',
    ...caveats.map((c) => `  • ${c}`),
    '',
    '  A platform that is missing, unconfigured, or failed tells you NOTHING about activity there.',
    '  Never report a gap in this data as a gap in the field.',
    '',
  ].join('\n');
}
