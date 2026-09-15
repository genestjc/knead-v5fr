/**
 * Judge a post against the rubric.
 *
 * Takes a caption, screenshots, or both — for ours and optionally for
 * competitors on the same subject. No platform credential is involved
 * anywhere: this is the path that works when Instagram and X will not talk to
 * us, and it reads more than their APIs would, because a screenshot contains
 * the photograph.
 *
 * Screenshots arrive as base64 in the body, which makes the request large.
 * They are NOT persisted — the model writes what it read into the stored
 * judgement, which is the part a person re-reading it needs. See
 * supabase/migrations/013_social_judge.sql.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { judgePost, renderJudgementSummary } from '@/lib/social/judge/judge';
import { criteriaFor, loadRubric, saveJudgement } from '@/lib/social/judge/store';
import type { JudgedPost, PostSource } from '@/lib/social/judge/types';
import { SOCIAL_PLATFORMS, platformLabel, type SocialPlatform } from '@/lib/social/types';
import { MAX_IMAGES_PER_REQUEST, type ImageInput } from '@/lib/ai/router';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

export async function POST(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const limit = await rateLimit('social54-judge', auth.address ?? getClientIp(req), {
    limit: 30,
    windowSeconds: 600,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Rate limit reached for judging. Each run is a model call against your key.' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);

  const platform = String(body?.platform ?? '').toLowerCase() as SocialPlatform;
  if (!SOCIAL_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { error: `Pick a platform. The rubric differs per platform — got "${body?.platform}".` },
      { status: 400 },
    );
  }

  const provider = body?.provider === 'openai' ? 'openai' : 'claude';
  const subject = String(body?.subject ?? '').trim().slice(0, 200) || null;

  const ours = parsePost(body?.ours, platform, true);
  const ourImages = parseImages(body?.ours?.images);

  if (!ours.text.trim() && ourImages.length === 0) {
    return NextResponse.json(
      { error: 'Nothing to judge — paste the caption or attach a screenshot.' },
      { status: 400 },
    );
  }

  const theirs = (Array.isArray(body?.theirs) ? body.theirs : [])
    .slice(0, 4)
    .map((entry: any) => ({
      post: parsePost(entry, platform, false),
      images: parseImages(entry?.images),
    }))
    // A competitor entry with neither caption nor screenshot contributes
    // nothing and would have the judge comparing against an empty post.
    .filter((entry: any) => entry.post.text.trim() || entry.images.length > 0);

  try {
    const { criteria } = await loadRubric();
    const applicable = criteriaFor(criteria, platform);

    if (applicable.length === 0) {
      return NextResponse.json(
        {
          error: `No active rubric criteria apply to ${platformLabel(platform)}. Add some in the Rubric tab — the judge has nothing to grade against.`,
        },
        { status: 400 },
      );
    }

    const output = await judgePost({
      provider,
      platform,
      criteria: applicable,
      ours,
      images: ourImages,
      theirs,
      subject,
    });

    // What the model read out of the screenshot replaces what was pasted, so a
    // saved judgement is readable after the image is gone.
    const post: JudgedPost = {
      ...ours,
      text: output.extracted.text || ours.text,
      comments: output.extracted.comments || ours.comments,
      handle: ours.handle ?? output.extracted.handle,
    };

    const title =
      String(body?.title ?? '').trim().slice(0, 160) ||
      `${platformLabel(platform)} — ${(post.text || 'screenshot').slice(0, 60)}`;

    const saved = await saveJudgement({
      title,
      platform,
      post,
      scores: output.scores,
      score: output.score,
      verdict: output.verdict,
      recommendations: output.recommendations,
      sentiment: output.sentiment,
      comparison: output.comparison,
      model: output.model,
      provider,
      createdBy: auth.address ?? null,
      parseError: output.parseError,
    });

    return NextResponse.json({
      judgement: saved,
      output,
      criteria: applicable,
      summary: renderJudgementSummary(output, applicable),
      // Surfaced beside the result rather than in place of it: the judgement
      // succeeded even when persisting it did not.
      saveFailed: saved === null,
    });
  } catch (err: any) {
    console.error('[social54] judge:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function parsePost(raw: any, platform: SocialPlatform, isOurs: boolean): JudgedPost {
  const source: PostSource =
    raw?.source === 'screenshot' || raw?.source === 'collected' ? raw.source : 'paste';
  return {
    platform,
    isOurs,
    handle: String(raw?.handle ?? '').trim().replace(/^@/, '').toLowerCase() || null,
    text: String(raw?.text ?? '').slice(0, 8_000),
    comments: String(raw?.comments ?? '').slice(0, 20_000),
    url: String(raw?.url ?? '').trim() || null,
    source,
  };
}

/**
 * Accept base64 images, with or without a data: prefix.
 *
 * The prefix is stripped here rather than in the client because a browser's
 * FileReader produces it by default, and an unstripped one reaches Anthropic
 * as corrupt base64 and fails the whole call with an opaque message.
 */
function parseImages(raw: unknown): ImageInput[] {
  if (!Array.isArray(raw)) return [];
  const images: ImageInput[] = [];

  for (const entry of raw.slice(0, MAX_IMAGES_PER_REQUEST)) {
    const value = String((entry as any)?.data ?? entry ?? '');
    if (!value) continue;

    const match = value.match(/^data:(image\/[a-z]+);base64,(.*)$/is);
    const declared = String((entry as any)?.mediaType ?? match?.[1] ?? 'image/png').toLowerCase();
    const data = match ? match[2] : value;

    const mediaType = (MEDIA_TYPES as readonly string[]).includes(declared)
      ? (declared as ImageInput['mediaType'])
      : 'image/png';

    if (data) images.push({ data, mediaType });
  }

  return images;
}
