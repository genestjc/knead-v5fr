/**
 * The competitor roster — who we measure ourselves against.
 *
 * GET seeds the table on first read (see lib/social/store.ts for why that is
 * guarded on the table being empty rather than per-name) and returns it.
 * POST adds one.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { createCompetitor, loadCompetitors, normalizeHandles } from '@/lib/social/store';
import { normalizeFeedInput } from '@/lib/social/editorial';

export const dynamic = 'force-dynamic';

const MAX_NAME_CHARS = 120;
const MAX_NOTE_CHARS = 500;

export async function GET(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    const { competitors, seedError } = await loadCompetitors();
    return NextResponse.json({ competitors, seedError });
  } catch (err: any) {
    console.error('[social54] competitors GET:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim().slice(0, MAX_NAME_CHARS);
  const note = String(body?.note ?? '').trim().slice(0, MAX_NOTE_CHARS) || null;
  const handles = normalizeHandles(body?.handles);
  const siteOrFeed = String(body?.feedUrl ?? '').trim();

  if (!name) return NextResponse.json({ error: 'A name is required.' }, { status: 400 });

  // A feed alone is a legitimate roster entry. Coverage and cadence are the
  // comparisons that stay fair across an audience-size gap, so a publication
  // we can only read the journalism of is still worth tracking — and for a
  // small account it is often worth more than the handles.
  if (handles.length === 0 && !siteOrFeed) {
    return NextResponse.json(
      {
        error:
          'Add at least one platform handle or a site/feed URL — a competitor with neither is never collected.',
      },
      { status: 400 },
    );
  }

  // Accepts a homepage as readily as a feed: nobody knows their competitors'
  // feed URLs offhand, and requiring one is how this field stays empty.
  let feedUrl: string | null = null;
  let feedNote = '';
  if (siteOrFeed) {
    const resolved = await normalizeFeedInput(siteOrFeed);
    feedUrl = resolved.feedUrl;
    feedNote = resolved.note;
    if (!feedUrl && handles.length === 0) {
      return NextResponse.json({ error: resolved.note }, { status: 400 });
    }
  }

  try {
    return NextResponse.json({
      competitor: await createCompetitor({ name, note, handles, feedUrl }),
      // Reported rather than silently dropped: a roster entry whose feed could
      // not be found looks identical to one that was never given a site.
      feedNote,
    });
  } catch (err: any) {
    console.error('[social54] competitors POST:', err.message);
    const duplicate = /duplicate key|unique/i.test(err.message);
    return NextResponse.json(
      { error: duplicate ? `"${name}" is already on the roster.` : err.message },
      { status: duplicate ? 409 : 500 },
    );
  }
}
