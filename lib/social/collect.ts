/**
 * The fan-out: one pull across every platform, ours and the competitors'.
 *
 * Isolation is the whole design. Five connectors talk to five APIs with five
 * independent ways of being broken — an expired Instagram token, a rate-limited
 * X tier, a Zora endpoint that moved — and a console that shows nothing when
 * one of them fails is a console nobody opens. So every platform is settled
 * independently and a rejection becomes a labelled failed panel, never a
 * thrown request.
 *
 * Platforms run in parallel; accounts within a platform run in series. That
 * split is not arbitrary: the per-platform rate limits are what actually bind
 * here, and firing twelve concurrent requests at one API is the fastest way to
 * turn a working connector into a 429 for the rest of the window.
 */
import { DEFAULT_WINDOW_DAYS, MAX_WINDOW_DAYS, ownAccounts } from './config';
import { fetchFarcaster } from './providers/farcaster';
import { fetchInstagram } from './providers/instagram';
import { fetchLinkedIn } from './providers/linkedin';
import { fetchX } from './providers/x';
import { fetchZora } from './providers/zora';
import type { ProviderAccountRequest, ProviderFn } from './providers/shared';
import {
  SOCIAL_PLATFORMS,
  type Competitor,
  type PlatformResult,
  type SocialPlatform,
  type SocialSnapshot,
} from './types';

const PROVIDERS: Record<SocialPlatform, ProviderFn> = {
  instagram: fetchInstagram,
  x: fetchX,
  farcaster: fetchFarcaster,
  zora: fetchZora,
  linkedin: fetchLinkedIn,
};

export interface CollectOptions {
  windowDays?: number;
  /** Defaults to every platform. */
  platforms?: SocialPlatform[];
  /** Competitor roster. Pass [] for an ours-only pull. */
  competitors?: Competitor[];
  /** Pull reply text as well as post metrics. Costly — off by default. */
  includeComments?: boolean;
}

export async function collectSnapshot(opts: CollectOptions = {}): Promise<SocialSnapshot> {
  const windowDays = clampWindow(opts.windowDays);
  const platforms = opts.platforms?.length ? opts.platforms : SOCIAL_PLATFORMS;
  const competitors = opts.competitors ?? [];
  const includeComments = opts.includeComments ?? false;

  const own = ownAccounts();

  const results = await Promise.all(
    platforms.map(async (platform): Promise<PlatformResult> => {
      const accounts = accountsFor(platform, own, competitors);

      if (accounts.length === 0) {
        return {
          platform,
          ok: true,
          configured: false,
          source: 'none',
          error: null,
          note: `No handle is set for ${platform} — nothing to collect. Add one to the competitor roster, or set the Knead handle in lib/social/config.ts.`,
          accounts: [],
          posts: [],
          comments: [],
          fetchedMs: 0,
        };
      }

      try {
        return await PROVIDERS[platform]({ windowDays, accounts, includeComments });
      } catch (err: any) {
        // A connector that throws is a bug in the connector, not a reason to
        // lose the other four platforms' data.
        console.error(`[social54] ${platform} connector threw:`, err?.message);
        return {
          platform,
          ok: false,
          configured: false,
          source: 'none',
          error: err?.message ?? 'connector failed',
          note: null,
          accounts: [],
          posts: [],
          comments: [],
          fetchedMs: 0,
        };
      }
    }),
  );

  return {
    fetchedAt: new Date().toISOString(),
    windowDays,
    platforms: results,
  };
}

/** Our handle first, then every competitor that publishes on this platform. */
function accountsFor(
  platform: SocialPlatform,
  own: { platform: SocialPlatform; handle: string }[],
  competitors: Competitor[],
): ProviderAccountRequest[] {
  const accounts: ProviderAccountRequest[] = [];

  const ours = own.find((a) => a.platform === platform);
  if (ours) accounts.push({ handle: ours.handle, isOurs: true });

  for (const competitor of competitors) {
    if (!competitor.isActive) continue;
    for (const h of competitor.handles) {
      if (h.platform !== platform) continue;
      const handle = h.handle.trim().replace(/^@/, '').toLowerCase();
      if (!handle || accounts.some((a) => a.handle === handle)) continue;
      accounts.push({ handle, isOurs: false });
    }
  }

  return accounts;
}

export function clampWindow(days: unknown): number {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_WINDOW_DAYS;
  return Math.min(MAX_WINDOW_DAYS, Math.max(1, Math.round(n)));
}

/** Every post in a snapshot, flattened. */
export function allPosts(snapshot: SocialSnapshot) {
  return snapshot.platforms.flatMap((p) => p.posts);
}

export function allComments(snapshot: SocialSnapshot) {
  return snapshot.platforms.flatMap((p) => p.comments);
}

/**
 * The caveats a snapshot carries, as sentences.
 *
 * Every agent prompt gets this block. Without it a model reads five platforms
 * of which two are empty and concludes we have no LinkedIn presence, when the
 * truth is that LinkedIn has no credentials set. A confident wrong conclusion
 * from missing data is the failure mode this whole file is arranged against.
 */
export function collectionCaveats(snapshot: SocialSnapshot): string[] {
  const caveats: string[] = [];
  for (const p of snapshot.platforms) {
    if (!p.ok) {
      caveats.push(`${p.platform}: the pull FAILED (${p.error}). Absence of ${p.platform} data says nothing about activity there.`);
      continue;
    }
    if (p.posts.length === 0 && p.note) {
      caveats.push(`${p.platform}: no data — ${p.note}`);
      continue;
    }
    if (p.error) caveats.push(`${p.platform}: partial read — ${p.error}`);
    if (p.note) caveats.push(`${p.platform}: ${p.note}`);
    if (p.posts.length > 0 && p.comments.length === 0) {
      caveats.push(
        `${p.platform}: post metrics were collected but no reply text was. Do not read that as posts drawing no replies.`,
      );
    }
  }
  return caveats;
}
