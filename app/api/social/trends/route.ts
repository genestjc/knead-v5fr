/**
 * Trends — macro drift and micro spikes across the field.
 *
 * Two data sources, combined deliberately:
 *
 *  • A LIVE PULL for the current window, so today's posts are in.
 *  • The POST ARCHIVE for everything older, because no platform API reaches
 *    far enough back to support a macro claim. X's standard tier gives seven
 *    days; a "trend" read from seven days is a week's weather.
 *
 * The archive's real depth is measured and passed to the agent, which is
 * instructed to refuse macro claims under three weeks of history. A console
 * that quietly upgrades a week of data into a strategic trend is worse than
 * one that says it does not know yet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { clampWindow, collectSnapshot, collectionCaveats } from '@/lib/social/collect';
import {
  archiveCoverage,
  archiveEditorial,
  archivePosts,
  loadCompetitors,
  readArchivedPosts,
  updateCompetitor,
  createRun,
  completeRun,
} from '@/lib/social/store';
import { sweepEditorial } from '@/lib/social/editorial';
import { computeFieldStats, headlineComparison } from '@/lib/social/field';
import { analyzeTrends, renderTrendSummary } from '@/lib/social/agents/trends';
import type { SocialPost } from '@/lib/social/types';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const limit = await rateLimit('social54-trends', auth.address ?? getClientIp(req), {
    limit: 8,
    windowSeconds: 600,
  });
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limit reached for trend runs.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const windowDays = clampWindow(body?.windowDays);
  const provider = body?.provider === 'openai' ? 'openai' : 'claude';
  /** How far back to read the archive. Bounded by what the archive holds. */
  const lookbackDays = clampWindow(body?.lookbackDays ?? 60);

  let runId: string | null = null;

  try {
    const { competitors } = await loadCompetitors();

    const run = await createRun({
      kind: 'trends',
      title: `Trends — ${windowDays}d window, ${lookbackDays}d lookback`,
      provider,
      createdBy: auth.address ?? null,
    });
    runId = run.id;

    const snapshot = await collectSnapshot({ windowDays, competitors, includeComments: false });
    const fresh = snapshot.platforms.flatMap((p) => p.posts);
    await archivePosts(fresh);

    const archived = await readArchivedPosts({ days: lookbackDays }).catch((err) => {
      console.error('[social54] archive read failed:', err.message);
      return [] as SocialPost[];
    });

    // Live rows win on conflict: a post collected minutes ago carries newer
    // engagement than the same post read from the archive.
    const merged = new Map<string, SocialPost>();
    for (const post of archived) merged.set(`${post.platform}:${post.id}`, post);
    for (const post of fresh) merged.set(`${post.platform}:${post.id}`, post);
    const posts = [...merged.values()];

    const coverage = await archiveCoverage().catch(() => ({ earliest: null, posts: 0 }));
    const archiveDays = coverage.earliest
      ? Math.max(
          0,
          Math.round((Date.now() - Date.parse(coverage.earliest)) / 86_400_000),
        )
      : null;

    const stats = computeFieldStats(posts, windowDays);
    const caveats = collectionCaveats(snapshot);

    // What the field PUBLISHED, from their own feeds. Needs no platform
    // credential, and carries the one comparison that stays fair across an
    // audience-size gap — so a failure here is worth reporting but never worth
    // failing the run over.
    const editorial = await sweepEditorial(competitors, {
      windowDays: Math.max(windowDays, 14),
      includeSearchFallback: true,
    }).catch((err) => {
      console.error('[social54] editorial sweep failed:', err.message);
      return null;
    });

    if (editorial) {
      await archiveEditorial(editorial.items);

      // Write back any feed discovered from a homepage this run, so the
      // discovery fetches happen once rather than on every sweep. Failing here
      // costs a repeated lookup next time, nothing more.
      for (const result of editorial.results) {
        if (!result.discoveredFeedUrl) continue;
        const match = competitors.find((c) => c.name === result.source);
        if (!match) continue;
        await updateCompetitor(match.id, { feedUrl: result.discoveredFeedUrl }).catch((err) =>
          console.error(`[social54] could not store feed for ${result.source}:`, err.message),
        );
      }
    }

    const report = await analyzeTrends({
      provider,
      stats,
      posts,
      caveats,
      archiveDays,
      editorial,
    });
    const summary = renderTrendSummary(report);

    await completeRun(run.id, {
      status: 'complete',
      summary,
      model: report.model,
      payload: {
        report,
        stats,
        caveats,
        archiveDays,
        headline: headlineComparison(stats),
        editorial: editorial
          ? { results: editorial.results, windowDays: editorial.windowDays }
          : null,
      },
    });

    return NextResponse.json({
      run: { ...run, status: 'complete', summary, model: report.model },
      report,
      stats,
      caveats,
      archiveDays,
      editorial,
      headline: headlineComparison(stats),
    });
  } catch (err: any) {
    console.error('[social54] trends:', err.message);
    if (runId) await completeRun(runId, { status: 'failed', summary: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
