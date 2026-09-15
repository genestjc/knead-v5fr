/**
 * One competitor: edit their handles and note, deactivate them, or remove them.
 *
 * Deactivating is the softer option and the one the console offers first —
 * an inactive competitor stops being collected but keeps their archived posts,
 * so a comparison run against last month still resolves. Deleting the row does
 * not delete the archive either; social_posts is keyed by handle, not by
 * roster id, precisely so removing a competitor never rewrites history.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { deleteCompetitor, normalizeHandles, updateCompetitor } from '@/lib/social/store';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  const patch: Parameters<typeof updateCompetitor>[1] = {};

  if (typeof body?.name === 'string') {
    const name = body.name.trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: 'The name cannot be empty.' }, { status: 400 });
    patch.name = name;
  }
  if (body?.note !== undefined) {
    patch.note = String(body.note ?? '').trim().slice(0, 500) || null;
  }
  if (body?.handles !== undefined) {
    const handles = normalizeHandles(body.handles);
    if (handles.length === 0) {
      return NextResponse.json(
        { error: 'At least one platform handle is required — a competitor with no handles is never collected.' },
        { status: 400 },
      );
    }
    patch.handles = handles;
  }
  if (typeof body?.isActive === 'boolean') patch.isActive = body.isActive;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    return NextResponse.json({ competitor: await updateCompetitor(params.id, patch) });
  } catch (err: any) {
    console.error('[social54] competitor PATCH:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    await deleteCompetitor(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[social54] competitor DELETE:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
