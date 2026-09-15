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

  if (!name) return NextResponse.json({ error: 'A name is required.' }, { status: 400 });
  if (handles.length === 0) {
    // A competitor with no handle is invisible to every collector, and would
    // sit in the roster looking monitored while contributing nothing.
    return NextResponse.json(
      { error: 'At least one platform handle is required — a competitor with no handles is never collected.' },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ competitor: await createCompetitor({ name, note, handles }) });
  } catch (err: any) {
    console.error('[social54] competitors POST:', err.message);
    const duplicate = /duplicate key|unique/i.test(err.message);
    return NextResponse.json(
      { error: duplicate ? `"${name}" is already on the roster.` : err.message },
      { status: duplicate ? 409 : 500 },
    );
  }
}
