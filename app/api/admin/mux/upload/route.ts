import { NextRequest, NextResponse } from 'next/server';
import Mux from '@mux/mux-node';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req, { requireMaster: true });
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
    });

    const upload = await mux.video.uploads.create({
      cors_origin: process.env.NEXT_PUBLIC_APP_URL || '*',
      new_asset_settings: {
        playback_policy: ['public'],
        encoding_tier: 'smart',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        uploadId: upload.id,
        uploadUrl: upload.url,
      },
    });
  } catch (error: any) {
    console.error('[POST /api/admin/mux/upload]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create upload URL' },
      { status: 500 }
    );
  }
}
