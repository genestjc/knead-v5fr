/**
 * Saved test runs.
 *
 * GET  lists them, newest first, with a pass/fail tally for the table.
 * POST records a human run — either a session an admin ran by hand, or a real
 *      transcript pasted in (the only way to get the event-driven community
 *      chat agent into the rubric).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';
import { appendTurns, mapRun } from '@/lib/eval/store';
import { EVAL_SURFACES, type EvalRun } from '@/lib/eval/types';

export const dynamic = 'force-dynamic';

const VALID_SURFACES = EVAL_SURFACES.map((s) => s.id) as string[];

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const surface = req.nextUrl.searchParams.get('surface');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200);

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('eval_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (surface) query = query.eq('surface', surface);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const runs: EvalRun[] = (data ?? []).map(mapRun);

    // One extra query for the whole page of runs, tallied in memory — cheaper
    // than a count per row and precise enough for a summary column.
    if (runs.length > 0) {
      const { data: results } = await supabase
        .from('eval_results')
        .select('run_id, verdict')
        .in(
          'run_id',
          runs.map((r) => r.id),
        );

      const tally = new Map<string, { pass: number; fail: number; na: number }>();
      for (const row of results ?? []) {
        const entry = tally.get(row.run_id) ?? { pass: 0, fail: 0, na: 0 };
        entry[row.verdict as 'pass' | 'fail' | 'na'] += 1;
        tally.set(row.run_id, entry);
      }
      for (const run of runs) {
        run.counts = tally.get(run.id) ?? { pass: 0, fail: 0, na: 0 };
      }
    }

    return NextResponse.json({ runs });
  } catch (err: any) {
    console.error('[probatio] GET runs:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  const surface = String(body?.surface ?? '');
  const title = String(body?.title ?? '').trim();

  if (!VALID_SURFACES.includes(surface)) {
    return NextResponse.json({ error: 'Unknown surface' }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: 'Give the run a title' }, { status: 400 });
  }

  // Turns arrive either pre-parsed or as a pasted transcript.
  const turns: { role: string; content: string }[] = Array.isArray(body?.turns)
    ? body.turns
    : parseTranscript(String(body?.transcript ?? ''));

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('eval_runs')
      .insert({
        mode: 'human',
        surface,
        persona: body?.persona ?? null,
        title,
        notes: body?.notes ? String(body.notes) : null,
        status: 'complete',
        created_by: auth.address ?? null,
        metadata: { source: Array.isArray(body?.turns) ? 'structured' : 'pasted-transcript' },
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (turns.length > 0) {
      await appendTurns(
        data.id,
        turns.map((t, i) => ({
          turnIndex: i,
          role: t.role === 'agent' || t.role === 'assistant' ? 'agent' : 'user',
          content: String(t.content ?? ''),
          latencyMs: null,
          metadata: { source: 'manual' },
        })) as any,
      );
    }

    return NextResponse.json({ run: mapRun(data), turnsSaved: turns.length });
  } catch (err: any) {
    console.error('[probatio] POST run:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Parse a pasted transcript into turns. Accepts the shape people actually
 * paste — a speaker label at the start of a line, then the message under it:
 *
 *   User: what's this story about?
 *   Agent: It's a profile of…
 *
 * Anything before the first recognized label is dropped. Unlabeled paragraphs
 * continue the previous speaker, so multi-paragraph replies survive intact.
 */
function parseTranscript(raw: string): { role: string; content: string }[] {
  if (!raw.trim()) return [];

  const LABEL = /^\s*(user|persona|human|me|agent|assistant|demeter|knead)\s*[:\-—]\s*/i;
  const AGENT_LABELS = new Set(['agent', 'assistant', 'demeter', 'knead']);

  const turns: { role: string; content: string }[] = [];
  for (const line of raw.split('\n')) {
    const match = line.match(LABEL);
    if (match) {
      const label = match[1].toLowerCase();
      turns.push({
        role: AGENT_LABELS.has(label) ? 'agent' : 'user',
        content: line.slice(match[0].length).trim(),
      });
    } else if (turns.length > 0) {
      turns[turns.length - 1].content += `\n${line}`;
    }
  }

  return turns
    .map((t) => ({ ...t, content: t.content.trim() }))
    .filter((t) => t.content.length > 0);
}
