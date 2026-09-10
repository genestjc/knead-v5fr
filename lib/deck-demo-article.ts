/**
 * The article the /ai-3720-build deck demos Demeter on.
 *
 * Resolved from Sanity at render time rather than hardcoded to a slug: a slug
 * pinned in code rots the day the post is renamed, and the deck would then
 * demo a 404 in front of a prospect. We look for the intended feature by name
 * and fall back to the newest published post, so the slide always has a real
 * article behind it.
 */
import { client } from '@/sanity/client';

/** Who the deck wants: the Richard Nadler feature. */
const PREFERRED_NEEDLE = 'Nadler*';

export interface DemoArticle {
  slug: string;
  title: string;
  author: string | null;
  publishedAt: string | null;
  excerpt: string | null;
  imageUrl: string | null;
  isPremium: boolean;
  /** True when we fell back to the newest post instead of the intended one. */
  isFallback: boolean;
}

const FIELDS = `{
  "slug": slug.current,
  title,
  "author": author->name,
  publishedAt,
  excerpt,
  "imageUrl": mainImage.asset->url,
  isPremium,
  premium
}`;

const QUERY = `{
  "preferred": *[_type == "post" && defined(slug.current) && (
    title match $needle || author->name match $needle || pt::text(body) match $needle
  )] | order(publishedAt desc) [0] ${FIELDS},
  "newest": *[_type == "post" && defined(slug.current) && defined(author)]
    | order(publishedAt desc) [0] ${FIELDS}
}`;

interface RawPost {
  slug?: string;
  title?: string;
  author?: string;
  publishedAt?: string;
  excerpt?: string;
  imageUrl?: string;
  isPremium?: boolean;
  premium?: boolean;
}

function shape(post: RawPost, isFallback: boolean): DemoArticle | null {
  if (!post?.slug || !post.title) return null;
  return {
    slug: post.slug,
    title: post.title,
    author: post.author ?? null,
    publishedAt: post.publishedAt ?? null,
    excerpt: post.excerpt ?? null,
    // Sanity serves any width; ask for a sensible one rather than the original.
    imageUrl: post.imageUrl ? `${post.imageUrl}?w=900&fit=max&auto=format` : null,
    // The schema has carried both spellings over time; the post page reads both.
    isPremium: Boolean(post.isPremium || post.premium),
    isFallback,
  };
}

/**
 * Never throws: the deck is a page someone opens in front of a client, so a
 * CMS hiccup degrades to a panel that says so rather than a 500.
 */
export async function getDemoArticle(): Promise<DemoArticle | null> {
  try {
    const result = await client.fetch<{ preferred?: RawPost; newest?: RawPost }>(
      QUERY,
      { needle: PREFERRED_NEEDLE },
      { next: { revalidate: 3600 } },
    );

    const preferred = result?.preferred ? shape(result.preferred, false) : null;
    if (preferred) return preferred;

    return result?.newest ? shape(result.newest, true) : null;
  } catch (err) {
    console.error('[deck] Could not resolve the demo article:', err);
    return null;
  }
}
