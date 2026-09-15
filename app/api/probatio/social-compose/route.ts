/**
 * Drafts for a story we are actually publishing, written against an audit.
 *
 * GET lists recent stories from Sanity so the console can offer them.
 * POST drafts for one of them, optionally taking the findings of a social
 * audit run as the evidence to write against.
 *
 * The story is looked up server-side by slug rather than accepted as text from
 * the client. The composer's central rule is that it may only claim what the
 * story says, and that rule is worth nothing if the "story" is whatever the
 * caller typed into the box.
 *
 * The audit is read back out of its own run for the same reason: the shortfalls
 * the drafts are told not to repeat are the ones actually recorded against the
 * rubric, in the rubric's own words, not a summary the browser assembled.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireProbatioAdmin } from '@/lib/eval/require-admin';
import { listCriteria } from '@/lib/eval/store';
import { composeDrafts, renderComposerSummary, type AuditEvidence } from '@/lib/eval/social-composer';
import { findStoryBrief, listStoryBriefs } from '@/lib/eval/stories';
import {
  isSocialPlatform,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from '@/lib/eval/types';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    return NextResponse.json({ stories: await listStoryBriefs(30) });
  } catch (err: any) {
    console.error('[probatio] social-compose GET:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const limit = await rateLimit('probatio-social-compose', auth.address ?? getClientIp(req), {
    limit: 15,
    windowSeconds: 600,
  });
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limit reached for drafting.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const slug = String(body?.slug ?? '').trim();
  const provider = body?.provider === 'openai' ? 'openai' : 'claude';
  const platforms = parsePlatforms(body?.platforms);
  const auditRunId = String(body?.auditRunId ?? '').trim() || null;

  if (!slug) return NextResponse.json({ error: 'A story slug is required.' }, { status: 400 });

  try {
    const story = await findStoryBrief(slug);
    if (!story) {
      return NextResponse.json(
        { error: `No published story found for "${slug}".` },
        { status: 404 },
      );
    }

    // A missing or unreadable audit is not a reason to refuse to draft — it
    // just means the drafts rest on convention, which the prompt already knows
    // how to say.
    let audit: AuditEvidence | null = null;
    let auditNote: string | null = null;
    if (auditRunId) {
      try {
        audit = await loadAudit(auditRunId);
        if (!audit) auditNote = 'That audit run could not be found, so the drafts rest on convention.';
      } catch (err: any) {
        auditNote = `The audit could not be read (${err.message}), so the drafts rest on convention.`;
      }
    }

    const result = await composeDrafts({ provider, story, platforms, audit });

    return NextResponse.json({
      result,
      story,
      summary: renderComposerSummary(result),
      audit,
      auditNote,
    });
  } catch (err: any) {
    console.error('[probatio] social-compose:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Rebuild an audit's findings from what was stored.
 *
 * The differences and recommendations come off the run's metadata; the
 * shortfalls are read from eval_results joined against the rubric, so a verdict
 * a human later overrode on the Human Evaluation tab is the one the composer
 * writes against. The human's reading wins over the model's — that is the whole
 * point of having the override.
 */
async function loadAudit(runId: string): Promise<AuditEvidence | null> {
  const supabase = getSupabaseAdmin();

  const { data: run, error } = await supabase
    .from('eval_runs')
    .select('*')
    .eq('id', runId)
    .eq('surface', 'social-audit')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!run) return null;

  const metadata = run.metadata ?? {};
  const platform: SocialPlatform = isSocialPlatform(metadata.platform)
    ? metadata.platform
    : 'instagram';

  const { data: results } = await supabase
    .from('eval_results')
    .select('*')
    .eq('run_id', runId);

  const criteria = await listCriteria({ includeInactive: true });
  const byId = new Map(criteria.map((c) => [c.id, c]));

  // A human verdict beats the model's on the same row.
  const best = new Map<string, any>();
  for (const row of results ?? []) {
    const existing = best.get(row.criterion_id);
    if (!existing || row.judged_by === 'human') best.set(row.criterion_id, row);
  }

  const shortfalls = [...best.values()]
    .map((row) => ({ row, criterion: byId.get(row.criterion_id) }))
    .filter(
      ({ row, criterion }) =>
        criterion && row.verdict !== 'na' && row.verdict !== criterion.expectedVerdict,
    )
    .map(({ row, criterion }) => ({
      prompt: criterion!.prompt,
      rationale: String(row.rationale ?? ''),
      evidence: String(row.evidence ?? ''),
    }));

  return {
    platform,
    score: typeof metadata.score === 'number' ? metadata.score : null,
    verdict: String(run.summary ?? '').slice(0, 4_000),
    shortfalls,
    differences: Array.isArray(metadata.differences) ? metadata.differences : [],
    recommendations: Array.isArray(metadata.recommendations) ? metadata.recommendations : [],
  };
}

function parsePlatforms(value: unknown): SocialPlatform[] {
  if (!Array.isArray(value)) return [...SOCIAL_PLATFORMS];
  const picked = value.filter(isSocialPlatform);
  return picked.length ? picked : [...SOCIAL_PLATFORMS];
}
