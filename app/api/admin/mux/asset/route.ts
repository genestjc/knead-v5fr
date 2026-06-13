import { NextRequest, NextResponse } from 'next/server';
import Mux from '@mux/mux-node';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req, { requireMaster: true });
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get('uploadId');

    if (!uploadId) {
      return NextResponse.json(
        { success: false, error: 'uploadId is required' },
        { status: 400 }
      );
    }

    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
    });

    const upload = await mux.video.uploads.retrieve(uploadId);

    if (upload.status === 'errored') {
      return NextResponse.json(
        { success: false, error: 'Upload failed on Mux' },
        { status: 500 }
      );
    }

    if (upload.status !== 'asset_created' || !upload.asset_id) {
      return NextResponse.json({
        success: true,
        data: { status: upload.status, ready: false },
      });
    }

    const asset = await mux.video.assets.retrieve(upload.asset_id);

    if (asset.status !== 'ready') {
      return NextResponse.json({
        success: true,
        data: { status: asset.status, ready: false, assetId: asset.id },
      });
    }

    const playbackId = asset.playback_ids?.[0]?.id;

    return NextResponse.json({
      success: true,
      data: {
        ready: true,
        assetId: asset.id,
        playbackId,
        duration: asset.duration,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/admin/mux/asset]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check asset status' },
      { status: 500 }
    );
  }
}
