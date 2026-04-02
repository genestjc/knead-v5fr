import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dm/generate-dm-token
 * Generate a Daily.co meeting token for a DM peer-to-peer video call
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomName, walletAddress } = body;

    if (!roomName || !walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: roomName, walletAddress' },
        { status: 400 }
      );
    }

    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Daily.co API key not configured' },
        { status: 500 }
      );
    }

    // Both participants in a DM call have full permissions (owner)
    const tokenPayload = {
      properties: {
        room_name: roomName,
        user_name: walletAddress,
        is_owner: true,
        enable_screenshare: false,
        start_video_off: false,
        start_audio_off: false,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 2, // 2 hours
      },
    };

    const dailyResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(tokenPayload),
    });

    if (!dailyResponse.ok) {
      const errorText = await dailyResponse.text();
      console.error('Daily.co token error:', errorText);
      return NextResponse.json(
        { success: false, error: `Daily.co API error: ${errorText}` },
        { status: dailyResponse.status }
      );
    }

    const dailyData = await dailyResponse.json();

    return NextResponse.json({
      success: true,
      data: {
        token: dailyData.token,
      },
    });
  } catch (error: any) {
    console.error('Error generating DM token:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
