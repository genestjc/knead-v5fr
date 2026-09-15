/**
 * One criterion: edit it, deactivate it, or remove it.
 *
 * Deactivating is the softer option and the one the tab offers first. An
 * inactive criterion stops being sent to the judge but stays visible, so a row
 * someone turned off during one campaign can be turned back on — and past
 * judgements that scored against it still name it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { deleteCriterion, updateCriterion } from '@/lib/social/judge/store';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/lib/social/types';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  const patch: Parameters<typeof updateCriterion>[1] = {};

  if (body?.prompt !== undefined) {
    const prompt = String(body.prompt).trim().slice(0, 400);
    if (!prompt) return NextResponse.json({ error: 'The question cannot be empty.' }, { status: 400 });
    patch.prompt = prompt;
  }
  if (body?.guidance !== undefined) {
    const guidance = String(body.guidance).trim().slice(0, 2_000);
    if (!guidance) {
      return NextResponse.json(
        {
          error:
            'Guidance cannot be empty — it is what stops the judge drifting between runs.',
        },
        { status: 400 },
      );
    }
    patch.guidance = guidance;
  }
  if (body?.platform !== undefined) {
    const raw = String(body.platform ?? '').toLowerCase();
    patch.platform = SOCIAL_PLATFORMS.includes(raw as SocialPlatform)
      ? (raw as SocialPlatform)
      : null;
  }
  if (body?.expectedVerdict !== undefined) {
    patch.expectedVerdict = body.expectedVerdict === 'fail' ? 'fail' : 'pass';
  }
  if (body?.weight !== undefined) patch.weight = Number(body.weight) || 1;
  if (typeof body?.isActive === 'boolean') patch.isActive = body.isActive;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    return NextResponse.json({ criterion: await updateCriterion(params.id, patch) });
  } catch (err: any) {
    console.error('[social54] criterion PATCH:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    await deleteCriterion(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[social54] criterion DELETE:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
