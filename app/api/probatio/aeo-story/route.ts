/**
 * Start a story-vs-story AEO run.
 *
 * One subject, our article, and the competitors' coverage of the same subject.
 * Two passes: deterministic signals for every piece, then an editorial analyst
 * that reads the prose and says what the competitors have that we don't.
 *
 * The analyst pass is optional (`analyze: false` skips it) because it costs a
 * model call per run and the deterministic half is often enough to see the
 * problem — a piece that never names its subject in the title does not need an
 * LLM to explain why it loses.
 *
 * Same guards as the site audit: this fetches caller-supplied URLs, so it is
 * rate limited on top of the admin check and refuses private address literals.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireProbatioAdmin } from '@/lib/eval/require-admin';
import { appendTurns, mapRun, mapTurn } from '@/lib/eval/store';
import { runStoryAudit, renderStoryReport, type StoryTarget } from '@/lib/eval/aeo-story';
import { analyzeStory, renderAnalysisSummary, type StoryAnalysis } from '@/lib/eval/aeo-analyst';
import { assertPublicUrl } from '@/lib/eval/aeo-signals';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_TARGETS = 6;
const MAX_SUBJECT_CHARS = 120;

export async function POST(req: NextRequest) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const limit = await rateLimit('probatio-aeo-story', auth.address ?? getClientIp(req), {
    limit: 10,
    windowSeconds: 600,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Rate limit reached for story audits. Try again in a few minutes.' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const subject = String(body?.subject ?? '').trim().slice(0, MAX_SUBJECT_CHARS);
  const ourUrlRaw = String(body?.ourUrl ?? '').trim();
  const competitorRaw: string[] = Array.isArray(body?.competitorUrls)
    ? body.competitorUrls.map((v: unknown) => String(v ?? '').trim()).filter(Boolean)
    : [];
  const provider = body?.provider === 'openai' ? 'openai' : 'claude';
  const shouldAnalyze = body?.analyze !== false;

  if (!subject) {
    return NextResponse.json(
      { error: 'A subject is required — the person, place, or thing every piece is about.' },
      { status: 400 },
    );
  }
  if (!ourUrlRaw) return NextResponse.json({ error: 'Your article URL is required' }, { status: 400 });

  const targets: StoryTarget[] = [];
  try {
    targets.push({ url: assertPublicUrl(ourUrlRaw).toString(), isSubject: true });
    for (const raw of competitorRaw) targets.push({ url: assertPublicUrl(raw).toString(), isSubject: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const seen = new Set<string>();
  const deduped = targets.filter((t) => {
    if (seen.has(t.url)) return false;
    seen.add(t.url);
    return true;
  });

  if (deduped.length > MAX_TARGETS) {
    return NextResponse.json(
      { error: `Compare at most ${MAX_TARGETS} articles at a time (including ours).` },
      { status: 400 },
    );
  }
  if (deduped.length < 2) {
    return NextResponse.json(
      { error: 'Add at least one competitor article — there is nothing to compare against otherwise.' },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: run, error } = await supabase
      .from('eval_runs')
      .insert({
        mode: 'agent',
        surface: 'aeo-story',
        persona: null,
        driver_provider: shouldAnalyze ? provider : null,
        driver_model: null,
        title: String(body?.title ?? '').trim() || `${subject} — ours vs ${deduped.length - 1}`,
        status: 'running',
        created_by: auth.address ?? null,
        metadata: {
          subject,
          ourUrl: deduped[0].url,
          competitorUrls: deduped.slice(1).map((t) => t.url),
        },
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const outcome = await runStoryAudit(subject, deduped);

    const turns: any[] = [];
    let index = 0;
    for (const [i, s] of outcome.signals.entries()) {
      const isOurs = deduped[i]?.isSubject === true;
      turns.push({
        turnIndex: index++,
        role: 'event',
        content: `${isOurs ? 'OURS' : 'COMPETITOR'} · GET ${s.url}`,
        latencyMs: s.fetchMs,
        metadata: {
          status: s.httpStatus,
          isOurs,
          url: s.url,
          finalUrl: s.finalUrl,
          score: s.score,
          coverage: s.coverage,
          quotedPassages: s.quotedPassages,
          specificityMarkers: s.specificityMarkers,
          visibleWords: s.visibleWords,
          scriptTextRatio: s.scriptTextRatio,
          // Carried into the log so the judge weighs "could not read it"
          // differently from "there was nothing to read".
          extractionFailed: s.extractionFailed,
          extractionDiagnosis: s.extractionDiagnosis,
          article: s.article,
          checks: s.checks,
          ...(s.error ? { error: s.error } : {}),
        },
      });
      turns.push({
        turnIndex: index++,
        role: 'agent',
        content: renderStoryReport(s, isOurs, subject),
        latencyMs: null,
        metadata: { isOurs, score: s.score, url: s.url },
      });
    }

    turns.push({
      turnIndex: index++,
      role: 'event',
      content: renderFieldComparison(outcome, deduped, subject),
      latencyMs: null,
      metadata: {
        comparison: true,
        subject,
        subjectScore: outcome.subjectScore,
        fieldMedian: outcome.fieldMedian,
      },
    });

    // Editorial pass. Failing here must not lose the deterministic half, which
    // is the part that is always valid — record the failure as a turn instead.
    let analysis: StoryAnalysis | null = null;
    if (shouldAnalyze && outcome.anyReachable) {
      const ours = outcome.signals[0];
      const competitors = outcome.signals.slice(1).filter((s) => s.ok && s.extractedText);
      if (competitors.length === 0) {
        turns.push({
          turnIndex: index++,
          role: 'system',
          content:
            'Analyst skipped: no competitor article yielded extractable text. That is itself a finding — their prose may be client-rendered or gated.',
          latencyMs: null,
          metadata: { analystSkipped: true },
        });
      } else {
        try {
          analysis = await analyzeStory({ provider, subject, ours, competitors });
          turns.push({
            turnIndex: index++,
            role: 'agent',
            content: `ANALYST (${analysis.model})\n\n${renderAnalysisSummary(analysis)}`,
            latencyMs: null,
            metadata: {
              analyst: true,
              model: analysis.model,
              advantages: analysis.advantages,
              recommendations: analysis.recommendations,
            },
          });
        } catch (err: any) {
          console.error('[probatio] aeo-story analyst:', err.message);
          turns.push({
            turnIndex: index++,
            role: 'system',
            content: `Analyst pass failed: ${err.message}. The deterministic scores above are unaffected.`,
            latencyMs: null,
            metadata: { analystError: err.message },
          });
        }
      }
    }

    await appendTurns(run.id, turns);

    await supabase
      .from('eval_runs')
      .update({
        status: outcome.anyReachable ? 'complete' : 'failed',
        completed_at: new Date().toISOString(),
        ...(analysis ? { summary: renderAnalysisSummary(analysis), summary_author: provider } : {}),
        metadata: {
          subject,
          ourUrl: deduped[0].url,
          competitorUrls: deduped.slice(1).map((t) => t.url),
          subjectScore: outcome.subjectScore,
          fieldMedian: outcome.fieldMedian,
          scores: outcome.signals.map((s, i) => ({
            url: s.finalUrl || s.url,
            score: s.score,
            ok: s.ok,
            isOurs: deduped[i]?.isSubject === true,
          })),
        },
      })
      .eq('id', run.id);

    const { data: saved } = await supabase
      .from('eval_turns')
      .select('*')
      .eq('run_id', run.id)
      .order('turn_index', { ascending: true });

    return NextResponse.json({
      run: { ...mapRun(run), status: outcome.anyReachable ? 'complete' : 'failed' },
      turns: (saved ?? []).map(mapTurn),
      // The extracted text is large and only the server needs it; strip it.
      signals: outcome.signals.map(({ extractedText, ...rest }) => rest),
      subject,
      subjectScore: outcome.subjectScore,
      fieldMedian: outcome.fieldMedian,
      analysis,
      done: true,
    });
  } catch (err: any) {
    console.error('[probatio] aeo-story:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function renderFieldComparison(
  outcome: Awaited<ReturnType<typeof runStoryAudit>>,
  targets: StoryTarget[],
  subject: string,
): string {
  const lines: string[] = [`FIELD COMPARISON — "${subject}"`, ''];
  const rows = outcome.signals.map((s, i) => ({ s, isOurs: targets[i]?.isSubject === true }));
  rows.sort((a, b) => b.s.score - a.s.score);

  for (const [i, row] of rows.entries()) {
    lines.push(
      `${String(i + 1).padStart(2)}. ${String(row.s.score).padStart(3)}/100  ${hostOf(row.s.finalUrl || row.s.url)}` +
        `${row.isOurs ? ' ← OURS' : ''}${row.s.ok ? '' : '  (unreachable)'}`,
    );
  }

  lines.push('');
  if (outcome.subjectScore !== null && outcome.fieldMedian !== null) {
    const delta = outcome.subjectScore - outcome.fieldMedian;
    lines.push(
      `Ours scores ${outcome.subjectScore}; competitor median is ${outcome.fieldMedian} (${delta >= 0 ? '+' : ''}${delta}).`,
    );
  }

  // Where ours loses to the field, check by check.
  const ours = rows.find((r) => r.isOurs)?.s;
  const others = rows.filter((r) => !r.isOurs && r.s.ok).map((r) => r.s);
  if (ours?.ok && others.length) {
    const losing: string[] = [];
    for (const check of ours.checks) {
      if (check.weight === 0) continue;
      const peers = others
        .map((o) => o.checks.find((c) => c.id === check.id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));
      if (!peers.length) continue;
      const passing = peers.filter((p) => p.status === 'pass').length;
      if (check.status !== 'pass' && passing > peers.length / 2) {
        losing.push(`${check.label} — ${passing}/${peers.length} of the field passes, ours does not`);
      }
    }
    if (losing.length) {
      lines.push('', 'BEHIND THE FIELD ON:');
      losing.forEach((l) => lines.push(`  • ${l}`));
    } else {
      lines.push('', 'Ours is not behind the field on any scored check.');
    }
  }

  return lines.join('\n');
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
