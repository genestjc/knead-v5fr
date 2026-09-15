/**
 * Composer — drafts for a story we are actually publishing.
 *
 * GET lists recent stories from Sanity so the console can offer them; POST
 * drafts for one of them. The story is looked up server-side by slug rather
 * than accepted as text from the client: the composer's central rule is that
 * it may only claim what the story says, and that rule is worth nothing if the
 * "story" is whatever the caller typed into the box.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { clampWindow, collectSnapshot } from '@/lib/social/collect';
import { composeDrafts, renderComposerSummary } from '@/lib/social/agents/composer';
import { findStoryBrief, listStoryBriefs } from '@/lib/eval/stories';
import { readArchivedPosts, createRun, completeRun } from '@/lib/social/store';
import { SOCIAL_PLATFORMS, type SocialPlatform, type SocialPost } from '@/lib/social/types';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    return NextResponse.json({ stories: await listStoryBriefs(30) });
  } catch (err: any) {
    console.error('[social54] compose GET:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const limit = await rateLimit('social54-compose', auth.address ?? getClientIp(req), {
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
  const windowDays = clampWindow(body?.windowDays ?? 30);

  if (!slug) {
    return NextResponse.json({ error: 'A story slug is required.' }, { status: 400 });
  }

  let runId: string | null = null;

  try {
    const story = await findStoryBrief(slug);
    if (!story) {
      return NextResponse.json(
        { error: `No story found for slug "${slug}". The composer only drafts from published or draft stories in Sanity.` },
        { status: 404 },
      );
    }

    const run = await createRun({
      kind: 'compose',
      title: `Drafts — ${story.title}`,
      subject: story.slug,
      provider,
      createdBy: auth.address ?? null,
    });
    runId = run.id;

    // Format evidence is our own history. The archive is preferred — it has
    // more of it — with a live pull filling in anything posted since. A failure
    // on either side degrades the drafts to "inferred" rather than failing the
    // run, which is exactly what the composer's confidence field is for.
    const archived = await readArchivedPosts({ days: 120 }).catch(() => [] as SocialPost[]);
    let ourPosts = archived.filter((p) => p.isOurs);

    if (ourPosts.length === 0) {
      const snapshot = await collectSnapshot({ windowDays, competitors: [], includeComments: false });
      ourPosts = snapshot.platforms.flatMap((p) => p.posts).filter((p) => p.isOurs);
    }

    const result = await composeDrafts({ provider, story, ourPosts, platforms });
    const summary = renderComposerSummary(result);

    await completeRun(run.id, {
      status: 'complete',
      summary,
      model: result.model,
      payload: { result, story, evidencePosts: ourPosts.length },
    });

    return NextResponse.json({
      run: { ...run, status: 'complete', summary, model: result.model },
      result,
      story,
      evidencePosts: ourPosts.length,
    });
  } catch (err: any) {
    console.error('[social54] compose:', err.message);
    if (runId) await completeRun(runId, { status: 'failed', summary: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function parsePlatforms(raw: unknown): SocialPlatform[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const wanted = raw
    .map((v) => String(v ?? '').toLowerCase())
    .filter((v): v is SocialPlatform => SOCIAL_PLATFORMS.includes(v as SocialPlatform));
  return wanted.length ? wanted : undefined;
}
