/**
 * One saved run, whole: metadata, every turn with its behavior log, and every
 * verdict recorded against it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireProbatioAdmin } from '@/lib/eval/require-admin';
import { mapResult, mapRun, mapTurn } from '@/lib/eval/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    const supabase = getSupabaseAdmin();

    const { data: run, error } = await supabase
      .from('eval_runs')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    const [{ data: turns }, { data: results }] = await Promise.all([
      supabase
        .from('eval_turns')
        .select('*')
        .eq('run_id', params.id)
        .order('turn_index', { ascending: true }),
      supabase.from('eval_results').select('*').eq('run_id', params.id),
    ]);

    return NextResponse.json({
      run: {
        ...mapRun(run),
        turns: (turns ?? []).map(mapTurn),
        results: (results ?? []).map(mapResult),
      },
    });
  } catch (err: any) {
    console.error('[probatio] GET run:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });

  const patch: Record<string, any> = {};
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if ('notes' in body) patch.notes = body.notes ? String(body.notes) : null;
  if (typeof body.summary === 'string') {
    patch.summary = body.summary;
    patch.summary_author = 'human';
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('eval_runs')
      .update(patch)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ run: mapRun(data) });
  } catch (err: any) {
    console.error('[probatio] PATCH run:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  // Deleting a run takes its transcript and verdicts with it (ON DELETE
  // CASCADE), so this one requires the master wallet.
  const auth = await requireProbatioAdmin(req, { requireMaster: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    const { error } = await getSupabaseAdmin().from('eval_runs').delete().eq('id', params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    console.error('[probatio] DELETE run:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
