/**
 * The stories we are writing, as the composer needs them.
 *
 * lib/cms.ts returns posts with `content` already rendered to an HTML string.
 * The composer must not be handed that: tag soup in a prompt costs tokens and
 * gives the model markup to imitate, and a model that has seen `<blockquote>`
 * in its source material will occasionally emit one in an Instagram caption.
 *
 * So the HTML is reduced to prose here, and only the opening is carried — the
 * first several hundred words are where a piece establishes what it is about,
 * and the composer's rule is that it may only claim what it was shown. Sending
 * a whole feature would cost a large multiple of that for claims a social post
 * would never make.
 */
import { getPosts } from '@/lib/cms';
import { SITE_URL } from '@/lib/constants';
import type { StoryBrief } from './social-composer';

/** How much of a piece the composer sees. Enough to write from, not the feature. */
const OPENING_CHARS = 3_000;

/**
 * HTML → prose.
 *
 * Block-level tags become paragraph breaks before the tags are stripped;
 * removing them first would run the last word of one paragraph into the first
 * of the next, which reads to a model as a sentence nobody wrote.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, '\n($1)\n')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function storyUrl(slug: string): string {
  return `${SITE_URL.replace(/\/+$/, '')}/posts/${slug}`;
}

/** Recent stories, newest first, as briefs the composer can be pointed at. */
export async function listStoryBriefs(limit = 25): Promise<StoryBrief[]> {
  const posts = await getPosts(true);
  return posts.slice(0, limit).map(toBrief);
}

export async function findStoryBrief(slug: string): Promise<StoryBrief | null> {
  const wanted = slug.trim().toLowerCase();
  if (!wanted) return null;
  const posts = await getPosts(true);
  const match = posts.find((p) => p.slug.toLowerCase() === wanted);
  return match ? toBrief(match) : null;
}

function toBrief(post: Awaited<ReturnType<typeof getPosts>>[number]): StoryBrief {
  const text = post.content ? htmlToText(post.content) : '';
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? null,
    opening: text ? text.slice(0, OPENING_CHARS) : null,
    url: storyUrl(post.slug),
    author: post.author?.name ?? null,
    publishedAt: post.publishedAt ?? null,
  };
}
