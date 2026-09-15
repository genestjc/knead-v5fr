/**
 * Who we are on each platform, who we measure against, and what the
 * environment can actually reach.
 *
 * Knead's own handles are derived from lib/constants.ts rather than retyped.
 * SITE_SOCIAL_PROFILES is already the list an answer engine corroborates the
 * organization against, and a second hand-maintained copy here would drift
 * from it — at which point the console would be grading an account that isn't
 * ours while the structured data points somewhere else.
 */
import { SITE_SOCIAL_PROFILES } from '@/lib/constants';
import { PLATFORM_META, SOCIAL_PLATFORMS, type SocialPlatform } from './types';

/** Handles Knead publishes under, keyed by platform. */
export interface OwnAccount {
  platform: SocialPlatform;
  handle: string;
  url: string;
}

/**
 * Parse a profile URL into (platform, handle).
 *
 * Returns null for anything unrecognized rather than guessing: a bad handle
 * here means the console silently monitors someone else's account, which is
 * worse than monitoring nothing and saying so.
 */
export function parseProfileUrl(raw: string): OwnAccount | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);
  const first = (segments[0] ?? '').replace(/^@/, '').toLowerCase();
  if (!first) return null;

  const platform: SocialPlatform | null =
    host === 'instagram.com'
      ? 'instagram'
      : host === 'x.com' || host === 'twitter.com'
        ? 'x'
        : host === 'warpcast.com' || host === 'farcaster.xyz'
          ? 'farcaster'
          : host === 'zora.co'
            ? 'zora'
            : host === 'linkedin.com'
              ? 'linkedin'
              : null;

  if (!platform) return null;

  // LinkedIn profile URLs carry the type in the path: /company/knead-mag.
  if (platform === 'linkedin') {
    const handle = (segments[1] ?? '').toLowerCase();
    if (!handle) return null;
    return { platform, handle, url: url.toString() };
  }

  return { platform, handle: first, url: url.toString() };
}

/**
 * Knead's accounts.
 *
 * SITE_SOCIAL_PROFILES covers Instagram, X and Farcaster. Zora and LinkedIn
 * are declared here because the org schema does not list them — the footer
 * links to Zora, and LinkedIn is new enough that no profile URL exists in the
 * constants yet. Both are overridable by env so a handle change doesn't need a
 * deploy of two files.
 */
export function ownAccounts(): OwnAccount[] {
  const fromConstants = SITE_SOCIAL_PROFILES.map(parseProfileUrl).filter(
    (a): a is OwnAccount => a !== null,
  );

  const byPlatform = new Map<SocialPlatform, OwnAccount>();
  for (const account of fromConstants) byPlatform.set(account.platform, account);

  const zora = (process.env.KNEAD_ZORA_HANDLE || 'knead').toLowerCase();
  if (!byPlatform.has('zora')) {
    byPlatform.set('zora', { platform: 'zora', handle: zora, url: `https://zora.co/@${zora}` });
  }

  const linkedin = (process.env.KNEAD_LINKEDIN_SLUG || '').toLowerCase();
  if (linkedin && !byPlatform.has('linkedin')) {
    byPlatform.set('linkedin', {
      platform: 'linkedin',
      handle: linkedin,
      url: `https://www.linkedin.com/company/${linkedin}`,
    });
  }

  // Env overrides win outright — they exist to correct a wrong handle fast.
  const overrides: [SocialPlatform, string | undefined, (h: string) => string][] = [
    ['instagram', process.env.KNEAD_INSTAGRAM_HANDLE, (h) => `https://www.instagram.com/${h}/`],
    ['x', process.env.KNEAD_X_HANDLE, (h) => `https://x.com/${h}`],
    ['farcaster', process.env.KNEAD_FARCASTER_HANDLE, (h) => `https://warpcast.com/${h}`],
  ];
  for (const [platform, value, toUrl] of overrides) {
    const handle = (value ?? '').trim().replace(/^@/, '').toLowerCase();
    if (handle) byPlatform.set(platform, { platform, handle, url: toUrl(handle) });
  }

  return SOCIAL_PLATFORMS.map((p) => byPlatform.get(p)).filter((a): a is OwnAccount => Boolean(a));
}

export function ownHandle(platform: SocialPlatform): string | null {
  return ownAccounts().find((a) => a.platform === platform)?.handle ?? null;
}

/**
 * Whether a platform's authenticated connector can run.
 *
 * Note this is a check for PRESENCE, not validity. An expired Instagram token
 * is "configured" here and fails at fetch time with the API's own message,
 * which is the more useful error — "not configured" would send someone to
 * hunt for a variable that is already set.
 */
export function isConfigured(platform: SocialPlatform): boolean {
  return PLATFORM_META[platform].envVars.every((name) => Boolean(process.env[name]?.trim()));
}

export interface PlatformStatus {
  platform: SocialPlatform;
  label: string;
  configured: boolean;
  publicReadable: boolean;
  /** Required but unset env vars, so the console can name what to fill in. */
  missingEnv: string[];
  /** Unset vars that would widen what this platform can see, but aren't needed. */
  missingOptionalEnv: string[];
  /** Whether reading this platform at a useful volume generally costs money. */
  costsMoney: boolean;
  /**
   * True when this platform collects with no credentials and no spend. These
   * are what the console leads with: a monitoring tool nobody can open until
   * five API applications clear is a monitoring tool nobody opens.
   */
  freeAndReady: boolean;
  ownHandle: string | null;
}

export function platformStatuses(): PlatformStatus[] {
  const own = ownAccounts();
  return SOCIAL_PLATFORMS.map((platform) => {
    const meta = PLATFORM_META[platform];
    const configured = isConfigured(platform);
    return {
      platform,
      label: meta.label,
      configured,
      publicReadable: meta.publicReadable,
      missingEnv: meta.envVars.filter((name) => !process.env[name]?.trim()),
      missingOptionalEnv: (meta.optionalEnvVars ?? []).filter(
        (name) => !process.env[name]?.trim(),
      ),
      costsMoney: meta.costsMoney === true,
      freeAndReady: meta.publicReadable && !meta.costsMoney,
      ownHandle: own.find((a) => a.platform === platform)?.handle ?? null,
    };
  });
}

/**
 * Starter competitor set, written into the database on first load.
 *
 * These are independent culture/arts publications with an active feed across
 * more than one of our platforms — the only kind of comparison that says
 * anything. A publication that posts nowhere we post cannot be beaten or lost
 * to, so it is noise in a monitoring console however famous it is.
 *
 * The roster is meant to be edited in the Competitors tab. This seed exists so
 * a fresh environment has something to compare against on day one.
 */
export const COMPETITOR_SEED: {
  name: string;
  note: string;
  handles: { platform: SocialPlatform; handle: string }[];
  /**
   * The publication's homepage, not its feed.
   *
   * Seeding a guessed feed URL would bake in a guess that fails quietly on the
   * half of publications whose path I'd get wrong. A homepage is a fact, and
   * lib/social/editorial.ts discovers the feed from it on the first sweep and
   * stores what it found — so a wrong guess is impossible and the lookup
   * happens once.
   */
  siteUrl?: string;
}[] = [
  {
    name: 'Hyperallergic',
    note: 'Art criticism with real reporting cadence. The benchmark for art-story reach.',
    siteUrl: 'https://hyperallergic.com',
    handles: [
      { platform: 'instagram', handle: 'hyperallergic' },
      { platform: 'x', handle: 'hyperallergic' },
      { platform: 'linkedin', handle: 'hyperallergic' },
    ],
  },
  {
    name: 'It’s Nice That',
    note: 'Design and visual culture. Sets the format conventions we get compared to.',
    siteUrl: 'https://www.itsnicethat.com',
    handles: [
      { platform: 'instagram', handle: 'itsnicethat' },
      { platform: 'x', handle: 'itsnicethat' },
      { platform: 'linkedin', handle: 'it-s-nice-that' },
    ],
  },
  {
    name: 'Zora',
    note: 'The platform itself sets onchain publishing norms — watch the format, not the rivalry.',
    siteUrl: 'https://zora.co',
    handles: [
      { platform: 'farcaster', handle: 'zora' },
      { platform: 'x', handle: 'ourzora' },
      { platform: 'zora', handle: 'zora' },
    ],
  },
  {
    name: 'Paragraph',
    note: 'Onchain publishing peer. Closest competitor for the Farcaster readership.',
    siteUrl: 'https://paragraph.com',
    handles: [
      { platform: 'farcaster', handle: 'paragraph' },
      { platform: 'x', handle: 'paragraph_xyz' },
    ],
  },
  {
    name: 'Eater',
    note: 'Food vertical. Comparison target for the food stories, not the art ones.',
    siteUrl: 'https://www.eater.com',
    handles: [
      { platform: 'instagram', handle: 'eater' },
      { platform: 'x', handle: 'eater' },
    ],
  },
];

/**
 * How far back a pull reaches by default.
 *
 * Fourteen days is deliberate: it is two full posting weeks, which is the
 * shortest window where a weekly cadence shows up as a pattern rather than as
 * one data point. The trend agent splits it into two sevens to read movement.
 */
export const DEFAULT_WINDOW_DAYS = 14;
export const MAX_WINDOW_DAYS = 90;

/** Per-account post cap per pull. Keeps a fan-out across ~6 accounts bounded. */
export const MAX_POSTS_PER_ACCOUNT = 25;

/** Comments pulled per post for the sentiment read. */
export const MAX_COMMENTS_PER_POST = 25;
