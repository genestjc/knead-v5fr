import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { roomName, walletAddress, isHost } = await req.json();

    console.log('🎫 [generate-token] Request:', { roomName, walletAddress: walletAddress?.substring(0, 8), isHost });

    if (!roomName || !walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!process.env.DAILY_API_KEY) {
      console.error('❌ DAILY_API_KEY not set in environment variables');
      return NextResponse.json(
        { success: false, error: 'Daily.co API key not configured' },
        { status: 500 }
      );
    }

    // ✅ FIX: Ensure room_name matches exactly what was stored in database
    const tokenPayload = {
      properties: {
        room_name: roomName, // This MUST match the room name from database
        user_name: walletAddress.slice(0, 8),
        is_owner: isHost,
        enable_screenshare: isHost,
        start_video_off: false,
        start_audio_off: false,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 3, // 3 hours
      },
    };

    console.log('🎫 [generate-token] Generating token with payload:', tokenPayload);

    const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify(tokenPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [generate-token] Daily.co error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to generate token' },
        { status: 500 }
      );
    }

    const data = await response.json();
    console.log('✅ [generate-token] Token generated successfully');

    return NextResponse.json({
      success: true,
      data: {
        token: data.token,
      },
    });
  } catch (error) {
    console.error('❌ [generate-token] Exception:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
