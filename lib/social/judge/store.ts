/**
 * Supabase access for the social judge.
 *
 * Same arrangement as lib/eval/store.ts: row → camelCase mapping lives here so
 * the routes stay thin, and first-run seeding happens on read so a fresh
 * environment comes up with a working rubric instead of a blank page.
 *
 * Seeding is guarded on the table being EMPTY, not on each row being absent. A
 * rubric an editor has curated — three criteria removed, two reworded — must
 * not have the seed's rows reappear underneath them on the next page load. An
 * empty table means a fresh environment; one row in it means somebody made a
 * decision.
 */
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '../types';
import { JUDGE_RUBRIC_SEED } from './rubric-seed';
import type { Judgement, JudgeCriterion } from './types';

export function mapCriterion(row: any): JudgeCriterion {
  return {
    id: row.id,
    platform: row.platform ?? null,
    prompt: row.prompt,
    guidance: row.guidance ?? '',
    expectedVerdict: row.expected_verdict === 'fail' ? 'fail' : 'pass',
    weight: typeof row.weight === 'number' ? row.weight : 1,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface RubricLoad {
  criteria: JudgeCriterion[];
  /** Set when the seed insert was rejected AND the table is still empty. */
  seedError: string | null;
}

export async function loadRubric(
  opts: { includeInactive?: boolean } = {},
): Promise<RubricLoad> {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: countError } = await supabase
    .from('social_criteria')
    .select('id')
    .limit(1);

  if (countError) throw new Error(`Could not read the rubric: ${countError.message}`);

  let seedFailure: string | null = null;

  if ((existing ?? []).length === 0) {
    const { error } = await supabase.from('social_criteria').insert(
      JUDGE_RUBRIC_SEED.map((c, i) => ({
        platform: c.platform,
        prompt: c.prompt,
        guidance: c.guidance,
        expected_verdict: c.expectedVerdict ?? 'pass',
        weight: c.weight ?? 1,
        sort_order: i,
        is_active: true,
      })),
    );
    if (error) seedFailure = error.message;
  }

  let query = supabase
    .from('social_criteria')
    .select('*')
    .order('sort_order', { ascending: true });

  if (!opts.includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw new Error(`Could not read the rubric: ${error.message}`);

  const criteria = (data ?? []).map(mapCriterion);

  // Only report a failed seed if the rows really are still absent. Losing the
  // insert race to another admin is harmless — they filled the table, the read
  // above returns their rows, and there is nothing to say.
  return {
    criteria,
    seedError:
      seedFailure && criteria.length === 0
        ? `Could not seed the rubric: ${seedFailure}. These rows are defined in lib/social/judge/rubric-seed.ts — the database rejected the insert rather than the rubric being unwritten.`
        : null,
  };
}

/**
 * The criteria that apply to one platform: its own, plus every universal row.
 *
 * This is what the judge is handed. Sending the whole table would have it
 * grading an Instagram post on whether the first two lines survive LinkedIn's
 * "see more" cut.
 */
export function criteriaFor(
  criteria: JudgeCriterion[],
  platform: SocialPlatform,
): JudgeCriterion[] {
  return criteria.filter((c) => c.platform === null || c.platform === platform);
}

export async function createCriterion(input: {
  platform: SocialPlatform | null;
  prompt: string;
  guidance?: string;
  expectedVerdict?: 'pass' | 'fail';
  weight?: number;
}): Promise<JudgeCriterion> {
  const supabase = getSupabaseAdmin();

  // Append. Sorting by an existing max keeps a hand-added row at the bottom
  // rather than sharing sort_order 0 with the first seeded one.
  const { data: last } = await supabase
    .from('social_criteria')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);

  const { data, error } = await supabase
    .from('social_criteria')
    .insert({
      platform: input.platform,
      prompt: input.prompt,
      guidance: input.guidance ?? '',
      expected_verdict: input.expectedVerdict ?? 'pass',
      weight: Math.max(1, Math.min(3, input.weight ?? 1)),
      sort_order: (last?.[0]?.sort_order ?? 0) + 1,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Could not add the criterion: ${error.message}`);
  return mapCriterion(data);
}

export async function updateCriterion(
  id: string,
  patch: Partial<{
    platform: SocialPlatform | null;
    prompt: string;
    guidance: string;
    expectedVerdict: 'pass' | 'fail';
    weight: number;
    isActive: boolean;
  }>,
): Promise<JudgeCriterion> {
  const supabase = getSupabaseAdmin();
  const row: Record<string, any> = { updated_at: new Date().toISOString() };

  if (patch.platform !== undefined) {
    row.platform =
      patch.platform && SOCIAL_PLATFORMS.includes(patch.platform) ? patch.platform : null;
  }
  if (patch.prompt !== undefined) row.prompt = patch.prompt;
  if (patch.guidance !== undefined) row.guidance = patch.guidance;
  if (patch.expectedVerdict !== undefined) row.expected_verdict = patch.expectedVerdict;
  if (patch.weight !== undefined) row.weight = Math.max(1, Math.min(3, patch.weight));
  if (patch.isActive !== undefined) row.is_active = patch.isActive;

  const { data, error } = await supabase
    .from('social_criteria')
    .update(row)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Could not update the criterion: ${error.message}`);
  return mapCriterion(data);
}

export async function deleteCriterion(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('social_criteria').delete().eq('id', id);
  if (error) throw new Error(`Could not remove the criterion: ${error.message}`);
}

// ─── judgements ───────────────────────────────────────────────────────────

export function mapJudgement(row: any): Judgement {
  return {
    id: row.id,
    title: row.title,
    platform: row.platform,
    post: row.post ?? {},
    scores: row.scores ?? [],
    score: row.score ?? null,
    verdict: row.verdict ?? '',
    recommendations: row.recommendations ?? [],
    sentiment: row.sentiment ?? null,
    comparison: row.comparison ?? null,
    model: row.model ?? '',
    provider: row.provider ?? 'claude',
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    parseError: null,
  };
}

export async function saveJudgement(
  input: Omit<Judgement, 'id' | 'createdAt'>,
): Promise<Judgement | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('social_judgements')
    .insert({
      title: input.title,
      platform: input.platform,
      post: input.post,
      scores: input.scores,
      score: input.score,
      verdict: input.verdict,
      recommendations: input.recommendations,
      sentiment: input.sentiment,
      comparison: input.comparison,
      model: input.model,
      provider: input.provider,
      created_by: input.createdBy,
    })
    .select()
    .single();

  // A judgement that was produced but could not be recorded is still a success
  // from the caller's point of view — the result is in hand and gets returned.
  // Losing it over a write failure would be worse.
  if (error) {
    console.error('[social54] could not save judgement:', error.message);
    return null;
  }
  return mapJudgement(data);
}

export async function listJudgements(limit = 50): Promise<Judgement[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('social_judgements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not read judgements: ${error.message}`);
  return (data ?? []).map(mapJudgement);
}

export async function getJudgement(id: string): Promise<Judgement | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('social_judgements')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return mapJudgement(data);
}

export async function deleteJudgement(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('social_judgements').delete().eq('id', id);
  if (error) throw new Error(`Could not delete the judgement: ${error.message}`);
}
