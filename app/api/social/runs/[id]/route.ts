/**
 * One saved analysis, whole — its summary and the structured payload the
 * console renders it from.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { deleteRun, getRun } from '@/lib/social/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    const run = await getRun(params.id);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json({ run });
  } catch (err: any) {
    console.error('[social54] run GET:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    await deleteRun(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[social54] run DELETE:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
