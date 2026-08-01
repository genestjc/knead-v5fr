/**
 * LLM-as-judge. Reads a saved run's full transcript and behavior log, scores
 * it against the live rubric, writes the verdicts, and saves a summary.
 *
 * The verdicts are stored under judged_by = the judging provider, so they sit
 * alongside (never on top of) any human grading of the same run — which is
 * what lets you measure the judge against your own graders.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireProbatioAdmin } from '@/lib/eval/require-admin';
import { listCriteria, mapRun, mapTurn, upsertResults } from '@/lib/eval/store';
import { judgeRun } from '@/lib/eval/judge';
import { getPersona } from '@/lib/eval/personas';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  const runId = String(body?.runId ?? '');
  const provider = body?.provider === 'openai' ? 'openai' : 'claude';
  if (!runId) return NextResponse.json({ error: 'Missing runId' }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();

    const { data: runRow, error } = await supabase
      .from('eval_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!runRow) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    const run = mapRun(runRow);

    const { data: turnRows } = await supabase
      .from('eval_turns')
      .select('*')
      .eq('run_id', runId)
      .order('turn_index', { ascending: true });

    const turns = (turnRows ?? []).map(mapTurn);
    if (turns.length === 0) {
      return NextResponse.json({ error: 'This run has no turns to judge' }, { status: 400 });
    }

    const criteria = (await listCriteria()).filter((c) => c.surface === run.surface);
    if (criteria.length === 0) {
      return NextResponse.json(
        { error: 'No active rubric rows for this surface. Add some in Rubric Setting first.' },
        { status: 400 },
      );
    }

    const outcome = await judgeRun({
      provider,
      surface: run.surface,
      personaName: getPersona(run.persona ?? '')?.name ?? null,
      criteria,
      turns,
    });

    const results = await upsertResults(runId, provider, outcome.model, outcome.verdicts);

    if (outcome.summary) {
      await supabase
        .from('eval_runs')
        .update({ summary: outcome.summary, summary_author: provider })
        .eq('id', runId);
    }

    return NextResponse.json({
      results,
      summary: outcome.summary,
      judgeModel: outcome.model,
      judgedBy: provider,
      // Rows the judge declined to score — usually the session never went there.
      unscored: criteria.filter((c) => !outcome.verdicts.some((v) => v.criterionId === c.id)).length,
    });
  } catch (err: any) {
    console.error('[probatio] judge:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
