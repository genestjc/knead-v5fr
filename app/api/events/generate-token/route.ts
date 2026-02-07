import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

interface GenerateTokenRequest {
  roomName: string;
  walletAddress: string;
  isHost: boolean;
}

interface GenerateTokenResponse {
  token: string;
}

/**
 * POST /api/events/generate-token
 * Generate a Daily.co meeting token for a participant
 */
export async function POST(req: NextRequest) {
  try {
    const body: GenerateTokenRequest = await req.json();
    const { roomName, walletAddress, isHost } = body;

    if (!roomName || !walletAddress || isHost === undefined) {
      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: 'Missing required fields: roomName, walletAddress, isHost' 
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.DAILY_API_KEY;

    if (!apiKey) {
      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: 'DAILY_API_KEY not configured' 
        },
        { status: 500 }
      );
    }

    // Generate meeting token with appropriate permissions
    const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4),
          is_owner: isHost,
          enable_screenshare: isHost,
          start_video_off: !isHost,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + (4 * 60 * 60), // 4 hours from now
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Daily.co token API error:', errorText);
      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: `Failed to generate Daily.co token: ${errorText}` 
        },
        { status: 500 }
      );
    }

    const tokenData = await response.json();
    const token = tokenData.token;

    return NextResponse.json<ApiResponse<GenerateTokenResponse>>({
      success: true,
      data: {
        token,
      },
      message: 'Daily.co token generated successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/events/generate-token:', error);
    return NextResponse.json<ApiResponse<null>>(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
