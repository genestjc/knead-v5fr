/**
 * Saved analyses, newest first.
 *
 * Kept because a trend claim is only checkable against the last one. "Their
 * cadence is rising" means nothing on its own and everything next to the run
 * from three weeks ago that said it was flat.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { listRuns } from '@/lib/social/store';
import { SOCIAL_RUN_KINDS, type SocialRunKind } from '@/lib/social/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const raw = req.nextUrl.searchParams.get('kind');
  const kind = SOCIAL_RUN_KINDS.some((k) => k.id === raw) ? (raw as SocialRunKind) : undefined;

  try {
    return NextResponse.json({ runs: await listRuns(kind) });
  } catch (err: any) {
    console.error('[social54] runs GET:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
