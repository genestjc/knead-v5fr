/**
 * Start an agent evaluation run.
 *
 * Conversational surfaces are stepped one exchange at a time by the client
 * (see ./step) so the transcript builds live and no single request has to hold
 * a whole multi-turn session inside one function timeout.
 *
 * Audio summaries aren't a conversation, so the whole probe — cold request,
 * immediate repeat, Instagram in-app request — runs here in one shot and the
 * run comes back complete.
 */
import { NextRequest, NextResponse } from 'next/server';
import { client as sanity } from '@/lib/sanity';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireProbatioAdmin } from '@/lib/eval/require-admin';
import { appendTurns, mapRun, mapTurn } from '@/lib/eval/store';
import { getPersona } from '@/lib/eval/personas';
import { DRIVER_MODELS } from '@/lib/eval/driver';
import {
  CONVERSATIONAL_SURFACES,
  SURFACE_BLOCKERS,
  runAudioProbe,
  userAgentFor,
} from '@/lib/eval/surfaces';
import { EVAL_SURFACES, type EvalSurface } from '@/lib/eval/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const VALID_SURFACES = EVAL_SURFACES.map((s) => s.id) as string[];

export async function POST(req: NextRequest) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  const surface = String(body?.surface ?? '') as EvalSurface;
  const personaId = String(body?.persona ?? '');
  const provider = body?.provider === 'openai' ? 'openai' : 'claude';

  if (!VALID_SURFACES.includes(surface)) {
    return NextResponse.json({ error: 'Unknown surface' }, { status: 400 });
  }

  const blocker = SURFACE_BLOCKERS[surface];
  if (blocker) return NextResponse.json({ error: blocker }, { status: 400 });

  const persona = getPersona(personaId);
  if (!persona) return NextResponse.json({ error: 'Unknown persona' }, { status: 400 });

  const slug = normalizeSlug(body?.slug);
  if ((surface === 'article-agent' || surface === 'audio-summaries') && !slug) {
    return NextResponse.json({ error: 'An article slug is required for this surface' }, { status: 400 });
  }

  // Verify the story exists BEFORE burning a run on it. Demeter's chat route
  // falls back to generic mode when the slug matches nothing — it starts
  // hunting for the article with its search tools ("let me find it… found
  // it"), which looks like a working run but scores every article-specific
  // criterion against the wrong context. Better to refuse up front.
  if (surface === 'article-agent' || surface === 'audio-summaries') {
    const check = await verifyArticleExists(slug);
    if (!check.exists) {
      return NextResponse.json(
        {
          error:
            `No published story has the slug "${slug}". The field wants the bare slug — the part after /posts/ — not the full path or URL.` +
            (check.suggestions.length
              ? ` Recent slugs: ${check.suggestions.join(', ')}`
              : ''),
        },
        { status: 400 },
      );
    }
  }

  const maxTurns = clamp(Number(body?.maxTurns ?? persona.defaultTurns), 1, 20);
  const userAgent = userAgentFor(persona);
  const origin = req.nextUrl.origin;

  const metadata = {
    slug: slug || null,
    recipeIds: Array.isArray(body?.recipeIds) ? body.recipeIds : [],
    surfaceModel: body?.surfaceModel === 'gpt-5' ? 'gpt-5' : 'sonnet-5',
    maxTurns,
    userAgent,
    origin,
    inAppBrowser: persona.inAppBrowser ?? null,
  };

  try {
    const supabase = getSupabaseAdmin();

    const { data: run, error } = await supabase
      .from('eval_runs')
      .insert({
        mode: 'agent',
        surface,
        persona: persona.id,
        driver_provider: provider,
        driver_model: DRIVER_MODELS[provider],
        title:
          String(body?.title ?? '').trim() ||
          `${persona.name} · ${EVAL_SURFACES.find((s) => s.id === surface)?.label ?? surface}`,
        status: CONVERSATIONAL_SURFACES.includes(surface) ? 'running' : 'complete',
        created_by: auth.address ?? null,
        metadata,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Audio summaries: run the full probe now and return a finished run.
    if (surface === 'audio-summaries') {
      const probes = await runAudioProbe({ origin, userAgent, slug });

      const turns = probes.flatMap((p, i) => [
        {
          turnIndex: i * 2,
          role: 'event' as const,
          content: `${p.label} — POST /api/demeter/article-summary-audio { slug: "${slug}" }`,
          latencyMs: null,
          metadata: p.log,
        },
        {
          turnIndex: i * 2 + 1,
          role: 'agent' as const,
          content: p.text || '(no summary returned)',
          latencyMs: p.latencyMs,
          metadata: p.log,
        },
      ]);

      await appendTurns(run.id, turns as any);

      const failed = probes.every((p) => !p.text);
      await supabase
        .from('eval_runs')
        .update({
          status: failed ? 'failed' : 'complete',
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.id);

      const { data: saved } = await supabase
        .from('eval_turns')
        .select('*')
        .eq('run_id', run.id)
        .order('turn_index', { ascending: true });

      return NextResponse.json({
        run: { ...mapRun(run), status: failed ? 'failed' : 'complete' },
        turns: (saved ?? []).map(mapTurn),
        done: true,
      });
    }

    // Conversational surfaces: the client now calls /step until done.
    return NextResponse.json({ run: mapRun(run), turns: [], done: false });
  } catch (err: any) {
    console.error('[probatio] agent-run start:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

/**
 * Accept what people actually paste. Sanity matches `slug.current` exactly, so
 * a full URL, a leading `/posts/`, a trailing slash, or a `?utm_…` tail all
 * silently match nothing — copying a story's address out of the browser is the
 * obvious thing to do, and it used to fail without saying so.
 */
function normalizeSlug(raw: unknown): string {
  let slug = String(raw ?? '').trim();
  if (!slug) return '';

  // Full URL → pathname
  try {
    if (/^https?:\/\//i.test(slug)) slug = new URL(slug).pathname;
  } catch {
    /* not a parseable URL — keep going with the raw string */
  }

  slug = slug.split('?')[0].split('#')[0];
  slug = slug.replace(/^\/+/, '').replace(/\/+$/, '');
  slug = slug.replace(/^posts\//i, '');

  return slug.trim();
}

/** Does a published story with this slug exist? Returns recent slugs if not. */
async function verifyArticleExists(
  slug: string,
): Promise<{ exists: boolean; suggestions: string[] }> {
  try {
    const found = await sanity.fetch(`count(*[_type == "post" && slug.current == $slug])`, {
      slug,
    });
    if (found > 0) return { exists: true, suggestions: [] };

    const suggestions = await sanity.fetch(
      `*[_type == "post" && defined(slug.current)] | order(publishedAt desc)[0...5].slug.current`,
    );
    return { exists: false, suggestions: Array.isArray(suggestions) ? suggestions : [] };
  } catch (err) {
    // Sanity being unreachable shouldn't block a run — let it proceed and
    // surface the real problem in the transcript instead.
    console.error('[probatio] slug check failed:', err);
    return { exists: true, suggestions: [] };
  }
}
