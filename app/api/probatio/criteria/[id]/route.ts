/**
 * Edit or remove a single rubric row.
 *
 * DELETE archives by default (is_active = false) rather than dropping the row,
 * because eval_results references it — hard-deleting a criterion would cascade
 * away the verdicts of every past run that scored it. Pass ?hard=true to
 * really drop it, history included.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';
import { mapCriterion } from '@/lib/eval/store';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof body.prompt === 'string') {
    const prompt = body.prompt.trim();
    if (!prompt) return NextResponse.json({ error: 'The criterion text is required' }, { status: 400 });
    patch.prompt = prompt;
  }
  if ('guidance' in body) patch.guidance = body.guidance ? String(body.guidance).trim() : null;
  if (body.expectedVerdict === 'pass' || body.expectedVerdict === 'fail') {
    patch.expected_verdict = body.expectedVerdict;
  }
  if (typeof body.isActive === 'boolean') patch.is_active = body.isActive;
  if (typeof body.sortOrder === 'number') patch.sort_order = body.sortOrder;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('eval_criteria')
      .update(patch)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ criterion: mapCriterion(data) });
  } catch (err: any) {
    console.error('[probatio] PATCH criterion:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const hard = req.nextUrl.searchParams.get('hard') === 'true';

  try {
    const supabase = getSupabaseAdmin();

    if (hard) {
      const { error } = await supabase.from('eval_criteria').delete().eq('id', params.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ deleted: true, archived: false });
    }

    const { error } = await supabase
      .from('eval_criteria')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', params.id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ deleted: true, archived: true });
  } catch (err: any) {
    console.error('[probatio] DELETE criterion:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
