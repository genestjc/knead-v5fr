/**
 * Human grading. Writes verdicts against the rubric for a saved run.
 *
 * These are stored with judged_by = 'human', which is a different unique key
 * from an LLM judge's verdicts — so a human grading a run that Claude already
 * scored produces a side-by-side comparison rather than an overwrite.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireProbatioAdmin } from '@/lib/eval/require-admin';
import { upsertResults } from '@/lib/eval/store';

export const dynamic = 'force-dynamic';

const VALID_VERDICTS = new Set(['pass', 'fail', 'na']);

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  const incoming = Array.isArray(body?.verdicts) ? body.verdicts : null;
  if (!incoming) return NextResponse.json({ error: 'Missing verdicts' }, { status: 400 });

  const verdicts = incoming
    .filter((v: any) => v?.criterionId && VALID_VERDICTS.has(v?.verdict))
    .map((v: any) => ({
      criterionId: String(v.criterionId),
      verdict: v.verdict as 'pass' | 'fail' | 'na',
      rationale: v.rationale ? String(v.rationale) : null,
      evidence: v.evidence ? String(v.evidence) : null,
    }));

  if (verdicts.length === 0) {
    return NextResponse.json({ error: 'No valid verdicts in the request' }, { status: 400 });
  }

  try {
    const results = await upsertResults(params.id, 'human', auth.address ?? null, verdicts);
    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('[probatio] PUT results:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
