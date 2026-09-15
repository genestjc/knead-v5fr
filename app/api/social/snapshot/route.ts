/**
 * The pulse pull — everything, everywhere, once.
 *
 * GET returns the console's opening state without touching a single social
 * API: which platforms are configured, who is on the competitor roster, and
 * how far back the post archive reaches. That separation matters because the
 * page should render instantly and a collection takes tens of seconds across
 * five providers.
 *
 * POST does the collection, archives what came back, and returns it. Archiving
 * is best-effort and never fails the request: a snapshot the console can show
 * beats a 500 that says the database was busy.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { clampWindow, collectSnapshot, collectionCaveats } from '@/lib/social/collect';
import { platformStatuses } from '@/lib/social/config';
import { archiveCoverage, archivePosts, loadCompetitors } from '@/lib/social/store';
import { computeFieldStats, headlineComparison } from '@/lib/social/field';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/lib/social/types';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
// Five providers, serial within each. The Vercel maximum for this plan tier;
// the collector's own per-request timeouts keep it well inside.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    const [{ competitors, seedError }, coverage] = await Promise.all([
      loadCompetitors(),
      archiveCoverage().catch(() => ({ earliest: null, posts: 0 })),
    ]);

    return NextResponse.json({
      platforms: platformStatuses(),
      competitors,
      seedError,
      archive: coverage,
    });
  } catch (err: any) {
    console.error('[social54] snapshot GET:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  // A pull hits five third-party APIs on our credentials. The limit here is
  // about not burning their rate limits — ours recover, a revoked token does
  // not.
  const limit = await rateLimit('social54-snapshot', auth.address ?? getClientIp(req), {
    limit: 12,
    windowSeconds: 600,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Rate limit reached for pulls. Wait a few minutes — the platform APIs have their own limits and this one protects them.' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const windowDays = clampWindow(body?.windowDays);
  const includeComments = body?.includeComments === true;
  const platforms = parsePlatforms(body?.platforms);

  try {
    const { competitors } = await loadCompetitors();

    const snapshot = await collectSnapshot({
      windowDays,
      platforms,
      competitors,
      includeComments,
    });

    const posts = snapshot.platforms.flatMap((p) => p.posts);
    const archive = await archivePosts(posts);
    const stats = computeFieldStats(posts, windowDays);

    return NextResponse.json({
      snapshot,
      stats,
      headline: headlineComparison(stats),
      caveats: collectionCaveats(snapshot),
      archived: archive.saved,
      // Surfaced beside the data rather than in place of it — the pull
      // succeeded even when persisting it did not.
      archiveError: archive.error,
    });
  } catch (err: any) {
    console.error('[social54] snapshot POST:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Accept a platform filter, ignoring anything that isn't a real platform. */
function parsePlatforms(raw: unknown): SocialPlatform[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const wanted = raw
    .map((v) => String(v ?? '').toLowerCase())
    .filter((v): v is SocialPlatform => SOCIAL_PLATFORMS.includes(v as SocialPlatform));
  return wanted.length ? wanted : undefined;
}
