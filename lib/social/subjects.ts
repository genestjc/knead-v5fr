/**
 * Matching posts to the thing they are about.
 *
 * Head-to-head only means something if both sides are genuinely about the same
 * subject, and "contains the word" is not a good enough test. Two failures
 * matter, and both are handled here rather than in a prompt:
 *
 *   • Substring matching. "art" inside "artist", "Kim" inside "Kimchi". Every
 *     match is whole-word, Unicode-aware.
 *   • Name shortening. A post introduces "Richard Nadler" and then says
 *     "Nadler". Requiring the full string scores a piece that is entirely
 *     about him as not mentioning him. Any component of the name counts — and
 *     the matcher does not try to guess which component is the surname, since
 *     guessing wrong is exactly how that bug gets reintroduced.
 *
 * This is the same approach lib/eval/aeo-story.ts takes for article prose,
 * applied to the much shorter text of a social post. Short text is the reason
 * the threshold here is one mention rather than a density: a caption has room
 * to say a name once.
 */
import type { SocialPost } from './types';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word occurrences, so "art" does not match inside "artist". */
export function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(needle)}(?![\\p{L}\\p{N}])`, 'giu');
  return (haystack.match(re) ?? []).length;
}

export interface SubjectMatcher {
  subject: string;
  /** Name components long enough to be distinctive on their own. */
  candidates: string[];
  matches(text: string): boolean;
  /** Occurrences of the most-used component. */
  count(text: string): number;
  /** Whether the complete subject string appears, not just a component. */
  matchedFull(text: string): boolean;
}

export function subjectMatcher(subject: string): SubjectMatcher {
  const full = subject.trim().toLowerCase();
  // Drop connective words that would match in any text at all.
  const tokens = full.split(/\s+/).filter((t) => t.length > 3);
  const candidates = tokens.length > 0 ? tokens : full ? [full] : [];

  return {
    subject: full,
    candidates,
    matches(text: string): boolean {
      if (!text || !full) return false;
      const hay = text.toLowerCase();
      if (occurrences(hay, full) > 0) return true;
      // A hashtag is a real mention with the spaces removed: #richardnadler
      // is how half of Instagram refers to a subject, and requiring the spaced
      // form scores those posts as off-topic.
      const squashed = full.replace(/\s+/g, '');
      if (squashed.length > 4 && hay.includes(squashed)) return true;
      return candidates.some((t) => occurrences(hay, t) > 0);
    },
    count(text: string): number {
      if (!text || candidates.length === 0) return 0;
      const hay = text.toLowerCase();
      return Math.max(0, ...candidates.map((t) => occurrences(hay, t)));
    },
    matchedFull(text: string): boolean {
      return Boolean(text && full) && occurrences(text.toLowerCase(), full) > 0;
    },
  };
}

/** Everything a post can be matched on: its text, its tags, and its links. */
function searchableText(post: SocialPost): string {
  return [post.text, post.tags.join(' '), post.links.join(' ')].join(' \n ');
}

export function postsAboutSubject(posts: SocialPost[], subject: string): SocialPost[] {
  const matcher = subjectMatcher(subject);
  return posts.filter((p) => matcher.matches(searchableText(p)));
}

/**
 * Posts that carry a link to one of our stories.
 *
 * Matched on the slug rather than the full URL: the same story goes out with
 * UTM parameters on one platform, through a link shortener's expansion on
 * another, and bare in a Farcaster embed. The slug is the part that survives.
 */
export function postsLinkingToSlug(posts: SocialPost[], slug: string): SocialPost[] {
  const clean = slug.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!clean) return [];
  return posts.filter((p) =>
    p.links.some((link) => link.toLowerCase().includes(`/posts/${clean}`) || link.toLowerCase().endsWith(`/${clean}`)),
  );
}

/**
 * Split a set of posts into ours and theirs for one subject.
 *
 * Returns the competitor posts even when we have none of our own on the
 * subject — that case is a finding in itself (they covered it and we did not),
 * and returning an empty result would hide it.
 */
export interface SubjectSplit {
  subject: string;
  ours: SocialPost[];
  theirs: SocialPost[];
}

export function splitBySubject(posts: SocialPost[], subject: string): SubjectSplit {
  const matched = postsAboutSubject(posts, subject);
  return {
    subject,
    ours: matched.filter((p) => p.isOurs),
    theirs: matched.filter((p) => !p.isOurs),
  };
}
