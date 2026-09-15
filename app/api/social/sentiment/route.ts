/**
 * Sentiment — collect replies, then read them.
 *
 * This is the only route that asks the collectors for comment text, which is a
 * call per post on most platforms. It is deliberately a separate, rate-limited
 * action rather than part of the pulse pull: an editor opening the console
 * should not spend a hundred API calls and a model call to see follower counts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { clampWindow, collectSnapshot, collectionCaveats } from '@/lib/social/collect';
import { loadCompetitors, createRun, completeRun } from '@/lib/social/store';
import { analyzeSentiment, renderSentimentSummary } from '@/lib/social/agents/sentiment';
import { postsAboutSubject } from '@/lib/social/subjects';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const limit = await rateLimit('social54-sentiment', auth.address ?? getClientIp(req), {
    limit: 8,
    windowSeconds: 600,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Rate limit reached for sentiment runs. Each one pulls reply threads across every platform.' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const windowDays = clampWindow(body?.windowDays);
  const provider = body?.provider === 'openai' ? 'openai' : 'claude';
  const subject = String(body?.subject ?? '').trim().slice(0, 160) || null;

  let runId: string | null = null;

  try {
    const { competitors } = await loadCompetitors();

    const run = await createRun({
      kind: 'sentiment',
      title: subject ? `Sentiment — ${subject}` : `Sentiment — last ${windowDays} days`,
      subject,
      provider,
      createdBy: auth.address ?? null,
    });
    runId = run.id;

    const snapshot = await collectSnapshot({
      windowDays,
      competitors,
      includeComments: true,
    });

    const caveats = collectionCaveats(snapshot);
    const allPosts = snapshot.platforms.flatMap((p) => p.posts);
    const allComments = snapshot.platforms.flatMap((p) => p.comments);

    // Narrowing to a subject filters the POSTS, and the comments follow from
    // them. Filtering comments directly on the subject would drop every reply
    // that discusses the story without naming it — which is most of them.
    const ourPosts = allPosts.filter((p) => p.isOurs);
    const posts = subject ? postsAboutSubject(ourPosts, subject) : ourPosts;
    const postIds = new Set(posts.map((p) => p.id));
    const comments = allComments.filter((c) => postIds.has(c.postId));

    if (comments.length === 0) {
      // Nothing to read is a result, not a failure — and it must not be
      // reported as an absence of opinion. Say which of the two it is.
      const summary = [
        'No reply text was available to read.',
        '',
        'This is a collection outcome, not a finding: it means the replies could not be'
          + ' fetched, not that the posts drew none. What blocked each platform:',
        ...caveats.map((c) => `  • ${c}`),
      ].join('\n');

      await completeRun(run.id, {
        status: 'complete',
        summary,
        payload: { report: null, caveats, sampleSize: 0, subject },
      });

      return NextResponse.json({
        run: { ...run, status: 'complete', summary },
        report: null,
        caveats,
        sampleSize: 0,
      });
    }

    const report = await analyzeSentiment({ provider, posts, comments, caveats, subject });
    const summary = renderSentimentSummary(report);

    await completeRun(run.id, {
      status: 'complete',
      summary,
      model: report.model,
      payload: { report, caveats, sampleSize: comments.length, subject },
    });

    return NextResponse.json({
      run: { ...run, status: 'complete', summary, model: report.model },
      report,
      caveats,
      sampleSize: comments.length,
    });
  } catch (err: any) {
    console.error('[social54] sentiment:', err.message);
    if (runId) await completeRun(runId, { status: 'failed', summary: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
