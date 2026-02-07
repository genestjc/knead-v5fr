import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

interface DeleteDailyRoomRequest {
  roomName: string;
}

/**
 * DELETE /api/events/delete-daily-room
 * Delete a Daily.co room after an event ends
 */
export async function DELETE(req: NextRequest) {
  try {
    const body: DeleteDailyRoomRequest = await req.json();
    const { roomName } = body;

    if (!roomName) {
      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: 'Missing required field: roomName' 
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

    // Delete Daily.co room
    const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Daily.co delete API error:', errorText);
      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: `Failed to delete Daily.co room: ${errorText}` 
        },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Daily.co room deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/events/delete-daily-room:', error);
    return NextResponse.json<ApiResponse<null>>(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
