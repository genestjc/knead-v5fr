/**
 * Supabase access for Probatio Parsley.
 *
 * Row → camelCase mapping lives here so the API routes stay thin and the UI
 * only ever sees the shapes in ./types. Also owns first-run seeding: an empty
 * eval_criteria table is filled from RUBRIC_SEED once, so a fresh environment
 * comes up with the real rubric instead of a blank form.
 */
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { RUBRIC_SEED } from './rubric-seed';
import type { EvalCriterion, EvalResult, EvalRun, EvalTurn } from './types';

export function mapCriterion(row: any): EvalCriterion {
  return {
    id: row.id,
    surface: row.surface,
    prompt: row.prompt,
    guidance: row.guidance,
    expectedVerdict: row.expected_verdict,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTurn(row: any): EvalTurn {
  return {
    id: row.id,
    runId: row.run_id,
    turnIndex: row.turn_index,
    role: row.role,
    content: row.content,
    latencyMs: row.latency_ms,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export function mapResult(row: any): EvalResult {
  return {
    id: row.id,
    runId: row.run_id,
    criterionId: row.criterion_id,
    verdict: row.verdict,
    judgedBy: row.judged_by,
    judgeModel: row.judge_model,
    rationale: row.rationale,
    evidence: row.evidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRun(row: any): EvalRun {
  return {
    id: row.id,
    mode: row.mode,
    surface: row.surface,
    persona: row.persona,
    driverProvider: row.driver_provider,
    driverModel: row.driver_model,
    title: row.title,
    notes: row.notes,
    status: row.status,
    summary: row.summary,
    summaryAuthor: row.summary_author,
    createdBy: row.created_by,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

/**
 * Load the rubric, seeding the 35 starter test cases the first time this runs
 * against an empty table. Seeding is best-effort: if two admins open the
 * console simultaneously the second insert may lose the race, so we re-read
 * afterwards rather than trusting our own insert.
 */
export async function listCriteria(opts: { includeInactive?: boolean } = {}): Promise<EvalCriterion[]> {
  const supabase = getSupabaseAdmin();

  const { count, error: countError } = await supabase
    .from('eval_criteria')
    .select('id', { count: 'exact', head: true });

  if (countError) throw new Error(`Could not read the rubric: ${countError.message}`);

  if ((count ?? 0) === 0) {
    const rows = RUBRIC_SEED.map((c, i) => ({
      surface: c.surface,
      prompt: c.prompt,
      guidance: c.guidance,
      expected_verdict: c.expectedVerdict ?? 'pass',
      sort_order: i,
      is_active: true,
    }));
    const { error: seedError } = await supabase.from('eval_criteria').insert(rows);
    if (seedError) console.error('[probatio] rubric seed failed:', seedError.message);
  }

  let query = supabase
    .from('eval_criteria')
    .select('*')
    .order('surface', { ascending: true })
    .order('sort_order', { ascending: true });

  if (!opts.includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw new Error(`Could not read the rubric: ${error.message}`);
  return (data ?? []).map(mapCriterion);
}

/** Append turns to a run. Indices continue from whatever is already stored. */
export async function appendTurns(
  runId: string,
  turns: Omit<EvalTurn, 'id' | 'runId' | 'createdAt'>[],
): Promise<void> {
  if (turns.length === 0) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('eval_turns').insert(
    turns.map((t) => ({
      run_id: runId,
      turn_index: t.turnIndex,
      role: t.role,
      content: t.content,
      latency_ms: t.latencyMs,
      metadata: t.metadata ?? {},
    })),
  );
  if (error) throw new Error(`Could not save turns: ${error.message}`);
}

/**
 * Write verdicts, replacing any previous ones from the same grader for this
 * run. A human override and an LLM verdict live side by side (different
 * judged_by), so re-judging with Claude never wipes a human's grading.
 */
export async function upsertResults(
  runId: string,
  judgedBy: 'human' | 'claude' | 'openai',
  judgeModel: string | null,
  verdicts: {
    criterionId: string;
    verdict: 'pass' | 'fail' | 'na';
    rationale?: string | null;
    evidence?: string | null;
  }[],
): Promise<EvalResult[]> {
  const supabase = getSupabaseAdmin();
  if (verdicts.length === 0) return [];

  // Postgres rejects an ON CONFLICT batch that touches the same row twice
  // ("cannot affect row a second time"), which fails the entire upsert — so a
  // single repeated criterion cost every verdict in the run. The judge dedupes
  // too; this is the gate closest to the table, and it also covers the human
  // grading path. Last write for a criterion wins.
  const byCriterion = new Map<string, (typeof verdicts)[number]>();
  for (const v of verdicts) byCriterion.set(v.criterionId, v);
  const deduped = [...byCriterion.values()];

  const { data, error } = await supabase
    .from('eval_results')
    .upsert(
      deduped.map((v) => ({
        run_id: runId,
        criterion_id: v.criterionId,
        verdict: v.verdict,
        judged_by: judgedBy,
        judge_model: judgeModel,
        rationale: v.rationale ?? null,
        evidence: v.evidence ?? null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'run_id,criterion_id,judged_by' },
    )
    .select();

  if (error) throw new Error(`Could not save verdicts: ${error.message}`);
  return (data ?? []).map(mapResult);
}
