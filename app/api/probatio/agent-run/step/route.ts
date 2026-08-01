/**
 * One exchange of an agent evaluation run: the persona driver writes a
 * message, the live Knead surface answers, both are saved with the behavior
 * log, and the pair comes back for the UI to render.
 *
 * Stepping (rather than looping server-side) means the tester watches the
 * conversation build in real time, a stalled surface can't burn a whole
 * function timeout, and a run that breaks midway still has every turn up to
 * the break saved and gradeable.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireProbatioAdmin } from '@/lib/eval/require-admin';
import { appendTurns, listCriteria, mapRun, mapTurn } from '@/lib/eval/store';
import { getPersona } from '@/lib/eval/personas';
import { nextPersonaMessage } from '@/lib/eval/driver';
import { sendSurfaceTurn, CONVERSATIONAL_SURFACES } from '@/lib/eval/surfaces';
import type { EvalSurface, EvalTurn } from '@/lib/eval/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  const runId = String(body?.runId ?? '');
  if (!runId) return NextResponse.json({ error: 'Missing runId' }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();

    const { data: runRow, error: runError } = await supabase
      .from('eval_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle();

    if (runError) throw new Error(runError.message);
    if (!runRow) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    const run = mapRun(runRow);
    const surface = run.surface as EvalSurface;

    if (!CONVERSATIONAL_SURFACES.includes(surface)) {
      return NextResponse.json({ error: 'This surface is not stepped' }, { status: 400 });
    }

    const persona = getPersona(run.persona ?? '');
    if (!persona) return NextResponse.json({ error: 'Run has no valid persona' }, { status: 400 });

    const { data: turnRows } = await supabase
      .from('eval_turns')
      .select('*')
      .eq('run_id', runId)
      .order('turn_index', { ascending: true });

    const turns: EvalTurn[] = (turnRows ?? []).map(mapTurn);
    const exchanges = pairExchanges(turns);
    const maxTurns = Number(run.metadata?.maxTurns ?? persona.defaultTurns);

    if (exchanges.length >= maxTurns) {
      await finish(runId, 'complete');
      return NextResponse.json({ done: true, turns: [], exchangeCount: exchanges.length });
    }

    // The rubric steers the walk so the session actually exercises what will
    // be graded — same rows the judge reads later.
    const criteria = (await listCriteria()).filter((c) => c.surface === surface);

    const context = buildContext(surface, run.metadata);

    const personaMessage = await nextPersonaMessage({
      persona,
      provider: (run.driverProvider ?? 'claude') as 'claude' | 'openai',
      surface,
      criteria,
      context,
      goal: run.metadata?.personaGoal ?? null,
      exchanges,
    });

    if (!personaMessage) {
      await finish(runId, 'failed');
      return NextResponse.json(
        { error: 'The persona driver returned nothing. Try the other provider.' },
        { status: 502 },
      );
    }

    const reply = await sendSurfaceTurn(
      surface,
      {
        origin: run.metadata?.origin ?? req.nextUrl.origin,
        userAgent: run.metadata?.userAgent,
        slug: run.metadata?.slug ?? undefined,
        recipeIds: run.metadata?.recipeIds ?? [],
        surfaceModel: run.metadata?.surfaceModel ?? 'sonnet-5',
      },
      personaMessage,
      exchanges.flatMap((e) => [
        { role: 'user' as const, content: e.personaMessage },
        { role: 'assistant' as const, content: e.agentReply },
      ]),
    );

    const baseIndex = turns.length;
    const newTurns = [
      {
        turnIndex: baseIndex,
        role: 'user' as const,
        content: personaMessage,
        latencyMs: null,
        metadata: { persona: persona.id, driver: run.driverProvider, driverModel: run.driverModel },
      },
      {
        turnIndex: baseIndex + 1,
        role: 'agent' as const,
        content: reply.text || '(no response)',
        latencyMs: reply.latencyMs,
        metadata: reply.log,
      },
    ];

    await appendTurns(runId, newTurns as any);

    // A failed exchange ends the run rather than looping into the same error.
    const exchangeCount = exchanges.length + 1;
    const done = !reply.ok || exchangeCount >= maxTurns;
    if (done) await finish(runId, reply.ok ? 'complete' : 'failed');

    return NextResponse.json({
      done,
      exchangeCount,
      maxTurns,
      turns: newTurns,
      ...(reply.ok ? {} : { surfaceError: reply.log?.error ?? `HTTP ${reply.log?.status}` }),
    });
  } catch (err: any) {
    console.error('[probatio] agent-run step:', err.message);
    await finish(runId, 'failed').catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function finish(runId: string, status: 'complete' | 'failed') {
  await getSupabaseAdmin()
    .from('eval_runs')
    .update({ status, completed_at: new Date().toISOString() })
    .eq('id', runId);
}

/** Rebuild persona/agent pairs from stored turns, skipping event rows. */
function pairExchanges(turns: EvalTurn[]): { personaMessage: string; agentReply: string }[] {
  const out: { personaMessage: string; agentReply: string }[] = [];
  let pending: string | null = null;

  for (const turn of turns) {
    if (turn.role === 'user') {
      pending = turn.content;
    } else if (turn.role === 'agent' && pending !== null) {
      out.push({ personaMessage: pending, agentReply: turn.content });
      pending = null;
    }
  }
  return out;
}

function buildContext(surface: EvalSurface, metadata: Record<string, any>): string {
  if (surface === 'article-agent') {
    return `You opened the Knead story at /posts/${metadata?.slug}. The chat bubble is in the corner of the article. You have not read the whole piece yet.`;
  }
  const recipes = Array.isArray(metadata?.recipeIds) ? metadata.recipeIds : [];
  return `You are on Knead's /open-source page, talking to the build assistant. It helps people build their own version of a Knead-style site.${
    recipes.length ? ` The build recipes loaded are: ${recipes.join(', ')}.` : ''
  }`;
}
