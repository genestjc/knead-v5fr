import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      channelId,
      eventType,
      scheduledStart,
      scheduledEnd,
      videoEnabled,
      hostId,
      guestIds = [],
    } = body;

    // Validate required fields
    if (!title || !channelId || !eventType || !hostId || !scheduledStart || !scheduledEnd) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: `Missing required fields: ${
            !title ? 'title ' : ''
          }${!channelId ? 'channelId ' : ''}${!eventType ? 'eventType ' : ''}${
            !hostId ? 'hostId ' : ''
          }${!scheduledStart ? 'scheduledStart ' : ''}${!scheduledEnd ? 'scheduledEnd ' : ''}`,
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify host exists
    const { data: host, error: hostError } = await supabase
      .from('chat_users')
      .select('id')
      .eq('id', hostId)
      .single();

    if (hostError || !host) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Host user not found' },
        { status: 404 }
      );
    }

    // Create Daily.co room if video is enabled
    let dailyRoomUrl = null;
    let dailyRoomName = null;

    if (videoEnabled) {
      try {
        const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: `knead-event-${Date.now()}`,
            properties: {
              enable_screenshare: true,
              enable_chat: true,
              start_video_off: false,
              start_audio_off: false,
              max_participants: 50,
            },
          }),
        });

        if (dailyResponse.ok) {
          const dailyData = await dailyResponse.json();
          dailyRoomUrl = dailyData.url;
          dailyRoomName = dailyData.name;
        } else {
          console.error('Failed to create Daily.co room:', await dailyResponse.text());
        }
      } catch (dailyError) {
        console.error('Error creating Daily.co room:', dailyError);
        // Continue without Daily.co room - don't fail the entire event creation
      }
    }

    // Insert event into database
    const { data: event, error: insertError } = await supabase
      .from('chat_events')
      .insert({
        title,
        description,
        channel_id: channelId,
        event_type: eventType,
        host_id: hostId,
        guest_ids: guestIds,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        status: 'scheduled',
        video_enabled: videoEnabled,
        daily_room_url: dailyRoomUrl,
        daily_room_name: dailyRoomName,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating event:', insertError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to create event' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: event,
      message: 'Event created successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/events:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
