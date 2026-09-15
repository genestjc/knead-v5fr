/**
 * Shared types for Social 54 — the /social54 monitoring console.
 *
 * Five platforms publish five different shapes of the same act. Instagram
 * counts saves, X counts quotes, Farcaster counts recasts, Zora counts mints,
 * LinkedIn counts impressions on a post nobody can see the impressions of
 * unless they own it. Every downstream agent and every chart in the console
 * reads the normalized shapes below rather than any provider's payload, so a
 * platform that changes its field names is a one-file change in providers/.
 *
 * Two rules the normalization follows, because breaking either produces
 * confident nonsense in the analysis layer:
 *
 *   1. A metric a platform does not publish is `null`, never 0. Zero saves and
 *      "this platform has no concept of saves" are different facts, and an
 *      average that treats the second as the first drags every comparison
 *      toward zero.
 *   2. Cross-platform totals are only ever built from metrics every platform
 *      in the comparison actually reports. See lib/social/metrics.ts.
 *
 * These mirror the columns in supabase/migrations/011_social54.sql.
 */

export type SocialPlatform = 'instagram' | 'x' | 'farcaster' | 'zora' | 'linkedin';

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  'instagram',
  'x',
  'farcaster',
  'zora',
  'linkedin',
];

export interface PlatformMeta {
  id: SocialPlatform;
  label: string;
  /** What this platform is actually good for, in Knead's mix. */
  blurb: string;
  /** Env vars required before the connector can collect anything at all. */
  envVars: string[];
  /**
   * Env vars that widen what the connector can see but are not needed to run.
   * Kept separate so the console asks for the minimum to get started and
   * mentions the rest as an upgrade, rather than presenting one long list that
   * looks mandatory.
   */
  optionalEnvVars?: string[];
  /**
   * Whether this platform costs money to read at a useful volume. Surfaced in
   * the console because "unconfigured" and "unconfigured and behind a paywall"
   * are different problems with different answers.
   */
  costsMoney?: boolean;
  /**
   * Whether anything can be read without credentials. Farcaster and Zora are
   * open by design; the other three are not, and saying so in the UI is more
   * useful than an empty panel.
   */
  publicReadable: boolean;
}

export const PLATFORM_META: Record<SocialPlatform, PlatformMeta> = {
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    blurb: 'Where the covers and studio photography land. Reach is saves-driven.',
    // The token alone is enough (Instagram Login, no Facebook Page needed).
    // INSTAGRAM_BUSINESS_ACCOUNT_ID is optional and unlocks competitor data —
    // see optionalEnvVars and lib/social/providers/instagram.ts.
    envVars: ['INSTAGRAM_ACCESS_TOKEN'],
    optionalEnvVars: ['INSTAGRAM_BUSINESS_ACCOUNT_ID'],
    publicReadable: false,
  },
  x: {
    id: 'x',
    label: 'X',
    blurb: 'Story distribution and the argument around it. Quotes matter more than likes.',
    envVars: ['X_BEARER_TOKEN'],
    publicReadable: false,
    // The only platform here that generally needs a paid tier to read
    // timelines at any useful volume.
    costsMoney: true,
  },
  farcaster: {
    id: 'farcaster',
    label: 'Farcaster',
    blurb: 'The onchain-native readership. Small, high signal, fully public.',
    envVars: ['NEYNAR_API_KEY'],
    publicReadable: true,
  },
  zora: {
    id: 'zora',
    label: 'Zora',
    blurb: 'Where a story becomes a collectible. Collects are the only paid signal we get.',
    envVars: ['ZORA_API_KEY'],
    publicReadable: true,
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    blurb: 'Press, partnerships, and the trade audience. Low volume, long half-life.',
    envVars: ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_ORGANIZATION_URN'],
    publicReadable: false,
  },
};

export function platformLabel(platform: string): string {
  return PLATFORM_META[platform as SocialPlatform]?.label ?? platform;
}

/**
 * Engagement counters, normalized.
 *
 * Every field is `number | null`, and null means "this platform does not
 * report it" — see the header. `impressions` is separated from `views` on
 * purpose: a video view and an impression are not the same event, and summing
 * them would be inventing reach.
 */
export interface SocialMetrics {
  likes: number | null;
  comments: number | null;
  /** Retweets, recasts, reposts, shares. The "someone rebroadcast it" count. */
  reposts: number | null;
  /** Quote-posts. Rebroadcast WITH commentary — the strongest interest signal. */
  quotes: number | null;
  /** Saves/bookmarks. Instagram and X only. */
  saves: number | null;
  /** Video or media plays. */
  views: number | null;
  /** Times the post was served. Owner-only on every platform that has it. */
  impressions: number | null;
  /** Zora: paid collects/mints of the piece. */
  collects: number | null;
  /** Outbound link clicks, where the platform reports them. */
  clicks: number | null;
}

export const EMPTY_METRICS: SocialMetrics = {
  likes: null,
  comments: null,
  reposts: null,
  quotes: null,
  saves: null,
  views: null,
  impressions: null,
  collects: null,
  clicks: null,
};

export type MediaType = 'text' | 'image' | 'video' | 'carousel' | 'link' | 'mint' | 'unknown';

export interface SocialPost {
  platform: SocialPlatform;
  /** Platform-native post id. Unique within (platform, id). */
  id: string;
  url: string;
  /** Handle without the @, lowercased. */
  authorHandle: string;
  authorName: string | null;
  /** Ours, or a competitor's. Set by the collector from the account roster. */
  isOurs: boolean;
  text: string;
  mediaType: MediaType;
  publishedAt: string;
  metrics: SocialMetrics;
  /**
   * Follower count of the author AT COLLECTION TIME. Carried on the post so a
   * stored snapshot can still compute an engagement rate months later, when
   * the account's follower count has moved.
   */
  authorFollowers: number | null;
  /** Hashtags, lowercased, without the #. */
  tags: string[];
  /** Outbound links found in the post — how we tie a post back to a story. */
  links: string[];
}

/** A reply, comment, or quote — the raw material the sentiment agent reads. */
export interface SocialComment {
  platform: SocialPlatform;
  id: string;
  /** The post this responds to. */
  postId: string;
  authorHandle: string;
  text: string;
  publishedAt: string | null;
  likes: number | null;
}

export interface SocialAccount {
  platform: SocialPlatform;
  handle: string;
  displayName: string | null;
  url: string;
  followers: number | null;
  /** Posts in the collection window, not lifetime. */
  postsInWindow: number;
  isOurs: boolean;
}

/**
 * How a platform's data was obtained, which the console shows next to every
 * number. An audience that cannot tell an owner-authenticated read from a
 * public one will over-trust the second: public endpoints give likes and
 * recasts but never impressions, so a "reach" figure that quietly came from a
 * public read is a figure nobody should plan against.
 */
export type SourceKind = 'api' | 'public' | 'none';

export interface PlatformResult {
  platform: SocialPlatform;
  /** False when the fetch failed. A platform with no credentials is not an error. */
  ok: boolean;
  /** Whether this platform's credentials are present in the environment. */
  configured: boolean;
  source: SourceKind;
  /** Set when ok is false, or when a partial read dropped something. */
  error: string | null;
  /** Human-readable reason the platform returned nothing, if it returned nothing. */
  note: string | null;
  accounts: SocialAccount[];
  posts: SocialPost[];
  comments: SocialComment[];
  fetchedMs: number;
}

export interface SocialSnapshot {
  fetchedAt: string;
  windowDays: number;
  platforms: PlatformResult[];
}

/** A publication we measure ourselves against, per platform. */
export interface CompetitorHandle {
  platform: SocialPlatform;
  handle: string;
}

export interface Competitor {
  id: string;
  name: string;
  /** Why this one is in the set — kept so the roster doesn't drift into noise. */
  note: string | null;
  handles: CompetitorHandle[];
  /**
   * RSS/Atom feed, which is how we see what they PUBLISH without any platform
   * credential. Coverage and cadence are the two comparisons that stay fair
   * across an audience-size gap, so for a small account this is often worth
   * more than the handles — see lib/social/editorial.ts.
   */
  feedUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What kind of analysis produced a stored run. */
export type SocialRunKind = 'snapshot' | 'sentiment' | 'trends' | 'head-to-head' | 'compose';

export const SOCIAL_RUN_KINDS: { id: SocialRunKind; label: string; blurb: string }[] = [
  { id: 'snapshot', label: 'Pulse', blurb: 'A raw pull across every configured platform.' },
  { id: 'sentiment', label: 'Sentiment', blurb: 'What the replies actually say, and who is saying it.' },
  { id: 'trends', label: 'Trends', blurb: 'Macro drift and micro spikes across the field.' },
  { id: 'head-to-head', label: 'Head to head', blurb: 'Our post on a subject against theirs.' },
  { id: 'compose', label: 'Composer', blurb: 'Drafts for the stories we are publishing.' },
];

export type AgentProvider = 'claude' | 'openai';

export interface SocialRun {
  id: string;
  kind: SocialRunKind;
  title: string;
  /** Subject, topic, or story slug this run was about. Null for broad pulls. */
  subject: string | null;
  status: 'running' | 'complete' | 'failed';
  provider: AgentProvider | null;
  model: string | null;
  /** The rendered, human-readable result. Always set on a complete run. */
  summary: string | null;
  /** The structured result — shape depends on `kind`. */
  payload: Record<string, any>;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
}
