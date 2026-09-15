/**
 * Coverage — what the field published, on its own, with nothing attached.
 *
 * This route exists because the capability it exposes was invisible. The feed
 * sweep already ran, but only inside a Trends analysis, which costs a model
 * call and buries the result in prose. So an environment with no platform
 * credentials opened the console, saw three "set INSTAGRAM_ACCESS_TOKEN"
 * notices, and concluded the whole thing was gated — when the one source that
 * needs no credentials at all was working the entire time and simply had
 * nowhere to appear.
 *
 * Deliberately NO model call. This is a fetch, a parse and a sort. It is the
 * cheapest thing in the console and should stay that way: it is the screen
 * somebody opens to check the console is alive.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { clampWindow } from '@/lib/social/collect';
import { sweepEditorial } from '@/lib/social/editorial';
import {
  archiveEditorial,
  loadCompetitors,
  readArchivedEditorial,
  updateCompetitor,
} from '@/lib/social/store';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The archive alone — instant, and enough to render the tab on load.
 *
 * Separated from the sweep because reading other people's servers takes tens
 * of seconds across a roster, and the screen should not be blank while that
 * happens. Whatever the last sweep stored is shown immediately.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const days = clampWindow(req.nextUrl.searchParams.get('days') ?? 30);

  try {
    const [{ competitors }, items] = await Promise.all([
      loadCompetitors(),
      readArchivedEditorial({ days }).catch(() => []),
    ]);

    return NextResponse.json({
      items,
      days,
      // So the tab can say "3 of 5 publications have a feed" rather than
      // leaving an empty list to be read as "nobody published anything".
      roster: competitors.map((c) => ({
        id: c.id,
        name: c.name,
        feedUrl: c.feedUrl,
        isActive: c.isActive,
      })),
    });
  } catch (err: any) {
    console.error('[social54] coverage GET:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Run the sweep: fetch every feed, archive what came back, return it. */
export async function POST(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  // Looser than the analysis routes — this spends no model budget, only other
  // people's bandwidth, and the sweep is serial and polite about it.
  const limit = await rateLimit('social54-coverage', auth.address ?? getClientIp(req), {
    limit: 20,
    windowSeconds: 600,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Rate limit reached for coverage sweeps. These read other publications’ servers; give it a few minutes.' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const windowDays = clampWindow(body?.windowDays ?? 30);

  try {
    const { competitors } = await loadCompetitors();

    const sweep = await sweepEditorial(competitors, {
      windowDays,
      includeSearchFallback: body?.useSearchFallback === true,
    });

    const archive = await archiveEditorial(sweep.items);

    // Persist any feed discovered from a homepage this run, so the discovery
    // fetches happen once. A failure costs a repeated lookup, nothing more.
    for (const result of sweep.results) {
      if (!result.discoveredFeedUrl) continue;
      const match = competitors.find((c) => c.name === result.source);
      if (!match) continue;
      await updateCompetitor(match.id, { feedUrl: result.discoveredFeedUrl }).catch((err) =>
        console.error(`[social54] could not store feed for ${result.source}:`, err.message),
      );
    }

    return NextResponse.json({
      sweep,
      archived: archive.saved,
      archiveError: archive.error,
    });
  } catch (err: any) {
    console.error('[social54] coverage POST:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
