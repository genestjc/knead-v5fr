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
 * Load the rubric, seeding starter test cases for any surface that has none.
 *
 * Seeding is per-surface rather than per-table. A whole-table check only ever
 * fires on a brand-new environment, which means a surface added after the
 * first run — the AEO audit was the first — would come up with an empty rubric
 * forever and no way to judge a run. Scoping it to the surface lets new
 * surfaces arrive with their rows while leaving every existing row untouched:
 * a surface an admin has deliberately emptied is the one case this re-seeds,
 * which is a fair trade for not shipping a dead tab.
 *
 * Best-effort: if two admins open the console at once the second insert may
 * lose the race, so we re-read afterwards rather than trusting our own insert.
 * A genuinely failed seed throws — see the note above the check below.
 */
export async function listCriteria(opts: { includeInactive?: boolean } = {}): Promise<EvalCriterion[]> {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: countError } = await supabase
    .from('eval_criteria')
    .select('surface');

  if (countError) throw new Error(`Could not read the rubric: ${countError.message}`);

  const populated = new Set((existing ?? []).map((r: any) => r.surface));
  const missing = RUBRIC_SEED.filter((c) => !populated.has(c.surface));

  const missingSurfaces = Array.from(new Set(missing.map((c) => c.surface)));
  let seedFailure: string | null = null;

  if (missing.length > 0) {
    // Keep sort_order stable against the seed file so a partially seeded table
    // orders the same way a freshly seeded one does.
    const rows = missing.map((c) => ({
      surface: c.surface,
      prompt: c.prompt,
      guidance: c.guidance,
      expected_verdict: c.expectedVerdict ?? 'pass',
      sort_order: RUBRIC_SEED.indexOf(c),
      is_active: true,
    }));
    const { error: seedError } = await supabase.from('eval_criteria').insert(rows);
    if (seedError) seedFailure = seedError.message;
  }

  let query = supabase
    .from('eval_criteria')
    .select('*')
    .order('surface', { ascending: true })
    .order('sort_order', { ascending: true });

  if (!opts.includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw new Error(`Could not read the rubric: ${error.message}`);

  const criteria = (data ?? []).map(mapCriterion);

  // A failed seed used to be logged to the server console and swallowed. The
  // tab then rendered an empty rubric and told whoever was looking to "add
  // them in Rubric Setting" — sending them off to hand-write rows that are
  // already written here, when the real fault was the database rejecting the
  // insert (a stale CHECK constraint on `surface` does exactly this to a
  // surface added after the table was created).
  //
  // Only raise it if the rows really are still absent. Losing the insert race
  // to another admin is harmless: they filled the table, so the read below
  // returns their rows and there is nothing to report.
  if (seedFailure) {
    const stillEmpty = missingSurfaces.filter((s) => !criteria.some((c) => c.surface === s));
    if (stillEmpty.length > 0) {
      throw new Error(
        `Could not seed the rubric for ${stillEmpty.join(', ')}: ${seedFailure}. ` +
          'These rows are defined in lib/eval/rubric-seed.ts — the database rejected the insert rather than the rubric being unwritten.',
      );
    }
  }

  return criteria;
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
