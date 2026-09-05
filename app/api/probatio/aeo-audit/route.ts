/**
 * Start an AEO Audit run.
 *
 * Unlike the agent surfaces there is no persona and no conversation — the
 * whole audit runs here in one shot and the run comes back complete, the same
 * shape audio-summaries uses.
 *
 * This route makes outbound requests to URLs supplied by the caller, so it is
 * rate limited on top of the admin check. That matters more than usual while
 * PROBATIO_DEMO_MODE bypasses auth: without a limit, the URL alone would be a
 * request amplifier pointed at whatever the caller names. lib/eval/aeo-signals
 * refuses private address literals; keep this surface behind real auth in
 * production regardless.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireProbatioAdmin } from '@/lib/eval/require-admin';
import { appendTurns, mapRun, mapTurn } from '@/lib/eval/store';
import { runAeoAudit, type AuditTarget } from '@/lib/eval/aeo-audit';
import { assertPublicUrl } from '@/lib/eval/aeo-signals';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Each target costs up to four outbound fetches (page + robots + sitemap + llms). */
const MAX_TARGETS = 8;

export async function POST(req: NextRequest) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const limit = await rateLimit('probatio-aeo-audit', auth.address ?? getClientIp(req), {
    limit: 10,
    windowSeconds: 600,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Rate limit reached for audits. Try again in a few minutes.' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const subjectRaw = String(body?.subjectUrl ?? '').trim();
  const competitorsRaw: string[] = Array.isArray(body?.competitorUrls)
    ? body.competitorUrls.map((v: unknown) => String(v ?? '').trim()).filter(Boolean)
    : [];

  if (!subjectRaw) {
    return NextResponse.json({ error: 'A subject URL is required' }, { status: 400 });
  }

  // Validate every URL before spending a run on any of them.
  const targets: AuditTarget[] = [];
  try {
    targets.push({ url: assertPublicUrl(subjectRaw).toString(), isSubject: true });
    for (const raw of competitorsRaw) {
      targets.push({ url: assertPublicUrl(raw).toString(), isSubject: false });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // De-duplicate while keeping the subject first.
  const seen = new Set<string>();
  const deduped = targets.filter((t) => {
    if (seen.has(t.url)) return false;
    seen.add(t.url);
    return true;
  });

  if (deduped.length > MAX_TARGETS) {
    return NextResponse.json(
      { error: `Too many sites — audit at most ${MAX_TARGETS} at a time (including the subject).` },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const subjectHost = hostOf(deduped[0].url);

    const { data: run, error } = await supabase
      .from('eval_runs')
      .insert({
        mode: 'agent',
        surface: 'aeo-audit',
        // No persona drives an audit — the evidence is the site itself.
        persona: null,
        driver_provider: null,
        driver_model: null,
        title:
          String(body?.title ?? '').trim() ||
          `${subjectHost} vs ${deduped.length - 1} ${deduped.length === 2 ? 'competitor' : 'competitors'}`,
        status: 'running',
        created_by: auth.address ?? null,
        metadata: {
          subjectUrl: deduped[0].url,
          competitorUrls: deduped.slice(1).map((t) => t.url),
        },
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const outcome = await runAeoAudit(deduped);
    await appendTurns(run.id, outcome.turns as any);

    await supabase
      .from('eval_runs')
      .update({
        status: outcome.anyReachable ? 'complete' : 'failed',
        completed_at: new Date().toISOString(),
        metadata: {
          subjectUrl: deduped[0].url,
          competitorUrls: deduped.slice(1).map((t) => t.url),
          subjectScore: outcome.subjectScore,
          fieldMedian: outcome.fieldMedian,
          scores: outcome.signals.map((s) => ({ url: s.finalUrl || s.url, score: s.score, ok: s.ok })),
        },
      })
      .eq('id', run.id);

    const { data: saved } = await supabase
      .from('eval_turns')
      .select('*')
      .eq('run_id', run.id)
      .order('turn_index', { ascending: true });

    return NextResponse.json({
      run: {
        ...mapRun(run),
        status: outcome.anyReachable ? 'complete' : 'failed',
      },
      turns: (saved ?? []).map(mapTurn),
      signals: outcome.signals,
      subjectScore: outcome.subjectScore,
      fieldMedian: outcome.fieldMedian,
      done: true,
    });
  } catch (err: any) {
    console.error('[probatio] aeo-audit:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
