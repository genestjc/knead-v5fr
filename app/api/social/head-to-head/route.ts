/**
 * Head to head — our posts on one subject against the field's.
 *
 * Reads the archive as well as a live pull, because a comparison usually gets
 * run days after the posts went out, by which time some platforms' APIs no
 * longer return them. Scoring happens before the model call and is returned
 * whether or not the analyst pass succeeds: the scoreboard is arithmetic and
 * always valid, while the analysis is a judgement that can fail.
 *
 * `analyze: false` skips the model entirely. Often the scoreboard alone
 * answers the question — a subject where we posted once and they posted six
 * times does not need an LLM to explain the gap.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { clampWindow, collectSnapshot, collectionCaveats } from '@/lib/social/collect';
import { archivePosts, loadCompetitors, readArchivedPosts, createRun, completeRun } from '@/lib/social/store';
import {
  analyzeHeadToHead,
  renderHeadToHeadSummary,
  renderScoreboards,
  scoreSubject,
} from '@/lib/social/agents/head-to-head';
import type { SocialPost } from '@/lib/social/types';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_SUBJECT_CHARS = 160;

export async function POST(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const limit = await rateLimit('social54-head-to-head', auth.address ?? getClientIp(req), {
    limit: 10,
    windowSeconds: 600,
  });
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limit reached for head-to-head runs.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const subject = String(body?.subject ?? '').trim().slice(0, MAX_SUBJECT_CHARS);
  const windowDays = clampWindow(body?.windowDays);
  const lookbackDays = clampWindow(body?.lookbackDays ?? 45);
  const provider = body?.provider === 'openai' ? 'openai' : 'claude';
  const shouldAnalyze = body?.analyze !== false;

  if (!subject) {
    return NextResponse.json(
      { error: 'A subject is required — the person, show, place, or story every post is about.' },
      { status: 400 },
    );
  }

  let runId: string | null = null;

  try {
    const { competitors } = await loadCompetitors();

    const run = await createRun({
      kind: 'head-to-head',
      title: `${subject} — ours vs the field`,
      subject,
      provider: shouldAnalyze ? provider : null,
      createdBy: auth.address ?? null,
    });
    runId = run.id;

    const snapshot = await collectSnapshot({ windowDays, competitors, includeComments: false });
    const fresh = snapshot.platforms.flatMap((p) => p.posts);
    await archivePosts(fresh);

    const archived = await readArchivedPosts({ days: lookbackDays }).catch(() => [] as SocialPost[]);

    const merged = new Map<string, SocialPost>();
    for (const post of archived) merged.set(`${post.platform}:${post.id}`, post);
    for (const post of fresh) merged.set(`${post.platform}:${post.id}`, post);

    const outcome = scoreSubject([...merged.values()], subject);
    const caveats = collectionCaveats(snapshot);

    // Nothing matched. Say so as a fact about this pull rather than reporting
    // an empty comparison as a result.
    if (outcome.scoreboards.length === 0) {
      const summary =
        `Nothing in the collected window matched "${subject}" — from us or from any competitor. ` +
        `That is a fact about this pull (last ${windowDays} days live, ${lookbackDays} days of archive), not about the subject's coverage. ` +
        `Widen the lookback, or check the spelling of the subject as the posts would write it.`;

      await completeRun(run.id, {
        status: 'complete',
        summary,
        payload: { outcome, caveats, subject },
      });

      return NextResponse.json({
        run: { ...run, status: 'complete', summary },
        outcome,
        scoreboardText: renderScoreboards(outcome),
        report: null,
        caveats,
      });
    }

    let report = null;
    let analystError: string | null = null;
    if (shouldAnalyze) {
      try {
        report = await analyzeHeadToHead({ provider, outcome, caveats });
      } catch (err: any) {
        // The scoreboard is the part that is always valid. Losing it because
        // the analyst call failed would throw away the reliable half.
        console.error('[social54] head-to-head analyst:', err.message);
        analystError = `The analyst pass failed (${err.message}). The scoreboard above is unaffected.`;
      }
    }

    const summary = report
      ? renderHeadToHeadSummary(report)
      : [renderScoreboards(outcome), analystError].filter(Boolean).join('\n\n');

    await completeRun(run.id, {
      status: 'complete',
      summary,
      model: report?.model ?? null,
      payload: { outcome, report, caveats, subject, analystError },
    });

    return NextResponse.json({
      run: { ...run, status: 'complete', summary, model: report?.model ?? null },
      outcome,
      scoreboardText: renderScoreboards(outcome),
      report,
      analystError,
      caveats,
    });
  } catch (err: any) {
    console.error('[social54] head-to-head:', err.message);
    if (runId) await completeRun(runId, { status: 'failed', summary: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
