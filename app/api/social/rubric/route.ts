/**
 * The rubric — what the judge grades against.
 *
 * GET seeds it on first read (guarded on the table being empty, so a curated
 * rubric is never overwritten) and returns it. POST adds a criterion.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { createCriterion, loadRubric } from '@/lib/social/judge/store';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/lib/social/types';

export const dynamic = 'force-dynamic';

const MAX_PROMPT_CHARS = 400;
const MAX_GUIDANCE_CHARS = 2_000;

export async function GET(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    // Inactive rows are included: the rubric tab is where you re-enable one,
    // and a criterion you cannot see is a criterion you cannot restore.
    const { criteria, seedError } = await loadRubric({ includeInactive: true });
    return NextResponse.json({ criteria, seedError });
  } catch (err: any) {
    console.error('[social54] rubric GET:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  const prompt = String(body?.prompt ?? '').trim().slice(0, MAX_PROMPT_CHARS);
  const guidance = String(body?.guidance ?? '').trim().slice(0, MAX_GUIDANCE_CHARS);
  const rawPlatform = String(body?.platform ?? '').toLowerCase();

  if (!prompt) {
    return NextResponse.json(
      { error: 'A criterion needs a question — something a grader can answer yes or no.' },
      { status: 400 },
    );
  }
  if (!guidance) {
    // Enforced rather than optional. Vague criteria are where LLM-as-judge
    // scores drift: without a stated bar the same post scores differently on
    // Tuesday, and nobody can tell why.
    return NextResponse.json(
      {
        error:
          'A criterion needs guidance saying what counts as a pass. Without a concrete bar the judge drifts and the same post scores differently each run.',
      },
      { status: 400 },
    );
  }

  const platform: SocialPlatform | null = SOCIAL_PLATFORMS.includes(rawPlatform as SocialPlatform)
    ? (rawPlatform as SocialPlatform)
    : null;

  try {
    const criterion = await createCriterion({
      platform,
      prompt,
      guidance,
      expectedVerdict: body?.expectedVerdict === 'fail' ? 'fail' : 'pass',
      weight: Number(body?.weight) || 1,
    });
    return NextResponse.json({ criterion });
  } catch (err: any) {
    console.error('[social54] rubric POST:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
