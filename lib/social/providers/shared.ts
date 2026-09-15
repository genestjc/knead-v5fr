/**
 * Pieces every connector needs: the request shape, and the two bits of text
 * parsing that would otherwise be written five slightly different ways.
 */
import type { SocialPlatform } from '../types';

export interface ProviderAccountRequest {
  handle: string;
  isOurs: boolean;
}

export interface ProviderRequest {
  windowDays: number;
  accounts: ProviderAccountRequest[];
  /**
   * Whether to pull replies as well as posts. Costly — it is a call per post
   * on most platforms — so the pulse pull leaves it off and the sentiment run
   * turns it on.
   */
  includeComments: boolean;
}

export type ProviderFn = (req: ProviderRequest) => Promise<import('../types').PlatformResult>;

/**
 * Hashtags, lowercased and de-duplicated.
 *
 * Deliberately requires a letter somewhere in the tag: "#1" and "#2026" are
 * ordinals and years in ordinary prose, not topics, and counting them as tags
 * puts "1" at the top of every trend report.
 */
export function extractTags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const tags = matches
    .map((t) => t.slice(1).toLowerCase())
    .filter((t) => /\p{L}/u.test(t));
  return [...new Set(tags)];
}

/** Outbound links — how a post is tied back to the story it carries. */
export function extractLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.,;:]+$/, '')))];
}

/** Mentions, lowercased. Used to spot who a competitor is amplifying. */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@[A-Za-z0-9_.-]{2,}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase().replace(/[.]+$/, '')))];
}

export function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** An empty, successful result — what an unconfigured platform returns. */
export function unconfigured(platform: SocialPlatform, note: string) {
  return {
    platform,
    ok: true,
    configured: false,
    source: 'none' as const,
    error: null,
    note,
    accounts: [],
    posts: [],
    comments: [],
    fetchedMs: 0,
  };
}
