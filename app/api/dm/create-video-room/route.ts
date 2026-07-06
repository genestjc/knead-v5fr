import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberRequest } from '@/lib/auth/member-session';
import { isContributor } from '@/lib/blockchain/check-nft-ownership';

export const dynamic = 'force-dynamic';

interface CreateDmVideoRoomRequest {
  userId1: string;
  userId2: string;
}

/**
 * POST /api/dm/create-video-room
 * Create a temporary Daily.co room for DM peer-to-peer video calls
 */
export async function POST(req: NextRequest) {
  try {
    // Require member auth so this billable Daily.co room creation can't be hit
    // anonymously in a loop, and gate on contributor status (DM video is a
    // contributor-to-contributor feature).
    const auth = await verifyMemberRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { isContributor: eligible } = await isContributor(auth.address!);
    if (!eligible) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: contributor status required for video calls' },
        { status: 403 }
      );
    }

    const body: CreateDmVideoRoomRequest = await req.json();
    const { userId1, userId2 } = body;

    if (!userId1 || !userId2) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId1, userId2' },
        { status: 400 }
      );
    }

    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'DAILY_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Sort user IDs for consistent room naming
    const sortedUsers = [userId1, userId2].sort();
    const roomName = `dm-${sortedUsers[0].slice(0, 8)}-${sortedUsers[1].slice(0, 8)}-${Date.now()}`;

    // Create Daily.co room (peer-to-peer, 2 participants max)
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          enable_screenshare: false,
          enable_chat: false,
          enable_prejoin_ui: false,
          start_video_off: false,
          start_audio_off: false,
          max_participants: 2,
          exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // 2 hours
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Daily.co API error:', errorText);
      return NextResponse.json(
        { success: false, error: `Failed to create Daily.co room: ${errorText}` },
        { status: 500 }
      );
    }

    const roomData = await response.json();

    return NextResponse.json({
      success: true,
      data: {
        roomUrl: roomData.url,
        roomName,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/dm/create-video-room:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
