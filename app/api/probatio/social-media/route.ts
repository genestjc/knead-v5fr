/**
 * Screen recordings for the social audit.
 *
 * POST creates a Mux direct-upload URL and a row to track it.
 * GET  reports where an upload has got to, promoting the row to 'ready' with
 *      the playback ID once Mux finishes transcoding.
 *
 * The file never passes through this server. The browser PUTs it straight to
 * the URL Mux hands back, which is the whole reason a fifteen-second phone
 * recording is viable on a platform with a 4.5MB request body limit.
 *
 * A row is written before the upload starts rather than after it finishes, so
 * a recording that transcodes while the tab is closed is still findable. The
 * run_id is attached later, when the audit that uses it is saved — the
 * recording exists first and the run is built around it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireProbatioAdmin } from '@/lib/eval/require-admin';
import { createUpload, mapMedia, muxConfigured, resolveAsset } from '@/lib/eval/social-media';
import { isSocialPlatform } from '@/lib/eval/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  if (!muxConfigured()) {
    return NextResponse.json(
      {
        error:
          'Mux is not configured, so screen recordings cannot be uploaded. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET. Screenshots work without it.',
      },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);

  try {
    const { uploadId, uploadUrl } = await createUpload();

    const { data, error } = await getSupabaseAdmin()
      .from('eval_social_media')
      .insert({
        is_ours: body?.isOurs !== false,
        label: String(body?.label ?? '').slice(0, 200),
        platform: isSocialPlatform(body?.platform) ? body.platform : null,
        mux_upload_id: uploadId,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ media: mapMedia(data), uploadUrl });
  } catch (err: any) {
    console.error('[probatio] POST social-media:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const uploadId = req.nextUrl.searchParams.get('uploadId');
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const state = await resolveAsset(uploadId);

    // Nothing to write while Mux is still working — the row already says
    // 'waiting', and an update per poll is a write per second for no reason.
    if (state.status === 'waiting') {
      return NextResponse.json({ status: 'waiting' });
    }

    const { data, error } = await supabase
      .from('eval_social_media')
      .update({
        mux_asset_id: state.assetId,
        mux_playback_id: state.playbackId,
        duration_seconds: state.durationSeconds,
        status: state.status,
        error: state.error,
        updated_at: new Date().toISOString(),
      })
      .eq('mux_upload_id', uploadId)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);

    // The asset resolved but no row matched — the recording is fine, our
    // bookkeeping is not. Report the asset rather than the missing row: the
    // caller can still grade what Mux has.
    if (!data) {
      return NextResponse.json({
        status: state.status,
        media: null,
        playbackId: state.playbackId,
        durationSeconds: state.durationSeconds,
        error: state.error,
        warning: 'This upload has no tracking row, so it will not be listed with the run.',
      });
    }

    return NextResponse.json({ status: state.status, media: mapMedia(data) });
  } catch (err: any) {
    console.error('[probatio] GET social-media:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
