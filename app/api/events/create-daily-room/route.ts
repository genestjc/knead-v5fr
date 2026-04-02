import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

interface CreateDailyRoomRequest {
  eventId: string;
  eventTitle: string;
}

interface CreateDailyRoomResponse {
  roomUrl: string;
  roomName: string;
}

/**
 * POST /api/events/create-daily-room
 * Create a Daily.co room programmatically
 */
export async function POST(req: NextRequest) {
  try {
    const body: CreateDailyRoomRequest = await req.json();
    const { eventId, eventTitle } = body;

    if (!eventId || !eventTitle) {
      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: 'Missing required fields: eventId, eventTitle' 
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

    // Generate unique room name
    const roomName = `event-${eventId.slice(0, 8)}-${Date.now()}`;

    // Create Daily.co room
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          enable_screenshare: true,
          enable_chat: false, // Use Towns chat instead
          enable_prejoin_ui: false,
          enable_recording: 'cloud',
          start_video_off: false,
          start_audio_off: false,
          max_participants: 50,
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours from now
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Daily.co API error:', errorText);
      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: `Failed to create Daily.co room: ${errorText}` 
        },
        { status: 500 }
      );
    }

    const roomData = await response.json();
    const roomUrl = roomData.url;

    return NextResponse.json<ApiResponse<CreateDailyRoomResponse>>({
      success: true,
      data: {
        roomUrl,
        roomName,
      },
      message: 'Daily.co room created successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/events/create-daily-room:', error);
    return NextResponse.json<ApiResponse<null>>(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
