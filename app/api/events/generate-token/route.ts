import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { roomName, walletAddress, isHost } = await req.json();

    if (!roomName || !walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate Daily.co meeting token
    const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: walletAddress.slice(0, 8),
          is_owner: isHost, // Host gets owner privileges
          enable_screenshare: isHost, // Only host can screenshare
          start_video_off: false,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 3, // 3 hour expiry
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Daily.co token error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to generate token' },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      data: {
        token: data.token,
      },
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
