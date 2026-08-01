/**
 * The rubric — the single source of truth for both tabs.
 *
 * GET  lists it (seeding the starter edge cases on first run).
 * POST adds a new edge case.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';
import { listCriteria, mapCriterion } from '@/lib/eval/store';
import { EVAL_SURFACES } from '@/lib/eval/types';

export const dynamic = 'force-dynamic';

const VALID_SURFACES = EVAL_SURFACES.map((s) => s.id) as string[];

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    const criteria = await listCriteria({ includeInactive: true });
    return NextResponse.json({ criteria });
  } catch (err: any) {
    console.error('[probatio] GET criteria:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  const surface = String(body?.surface ?? '');
  const prompt = String(body?.prompt ?? '').trim();

  if (!VALID_SURFACES.includes(surface)) {
    return NextResponse.json({ error: 'Unknown surface' }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: 'The criterion text is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // New rows land at the end of their surface's list.
    const { data: last } = await supabase
      .from('eval_criteria')
      .select('sort_order')
      .eq('surface', surface)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('eval_criteria')
      .insert({
        surface,
        prompt,
        guidance: body?.guidance ? String(body.guidance).trim() : null,
        expected_verdict: body?.expectedVerdict === 'fail' ? 'fail' : 'pass',
        sort_order: (last?.sort_order ?? -1) + 1,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ criterion: mapCriterion(data) });
  } catch (err: any) {
    console.error('[probatio] POST criteria:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
