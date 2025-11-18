import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isAdmin } from '@/lib/chat/permissions';
import type { ApiResponse, ChatEvent, EventType } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * POST /api/events
 * Create a chat event with optional Daily.co video integration
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      channelId,
      eventType,
      hostId,
      guestIds,
      scheduledStart,
      scheduledEnd,
      videoEnabled,
      creatorId,
    } = body;

    if (!title || !channelId || !eventType || !hostId || !scheduledStart || !scheduledEnd || !creatorId) {
      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: 'Missing required fields: title, channelId, eventType, hostId, scheduledStart, scheduledEnd, creatorId' 
        },
        { status: 400 }
      );
    }

    // Validate event type
    const validEventTypes: EventType[] = ['live', 'discussion', 'essay'];
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify creator has admin permissions
    const { data: creator, error: creatorError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('id', creatorId)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Creator not found' },
        { status: 404 }
      );
    }

    const chatUser = {
      id: creator.id,
      address: creator.address,
      displayName: creator.display_name,
      avatar: creator.avatar,
      role: creator.role,
      membershipTier: creator.membership_tier,
      contributorType: creator.contributor_type,
      isBanned: creator.is_banned,
      bio: creator.bio,
      alias: creator.alias,
      createdAt: new Date(creator.created_at),
      updatedAt: new Date(creator.updated_at),
    };

    if (!isAdmin(chatUser)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only admins can create events' },
        { status: 403 }
      );
    }

    let dailyRoomUrl: string | undefined;
    let dailyRoomName: string | undefined;

    // Create Daily.co room if video is enabled
    if (videoEnabled && process.env.DAILY_API_KEY) {
      try {
        const roomName = `knead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const response = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: roomName,
            properties: {
              enable_screenshare: true,
              enable_chat: false, // Use Towns chat instead
              enable_prejoin_ui: true,
              enable_recording: 'cloud',
              start_video_off: false,
              start_audio_off: false,
              exp: Math.floor(new Date(scheduledEnd).getTime() / 1000) + 3600, // +1 hour buffer
            },
          }),
        });

        if (!response.ok) {
          console.error('Daily.co API error:', await response.text());
          return NextResponse.json<ApiResponse<null>>(
            { success: false, error: 'Failed to create video room' },
            { status: 500 }
          );
        }

        const roomData = await response.json();
        dailyRoomUrl = roomData.url;
        dailyRoomName = roomData.name;
      } catch (error) {
        console.error('Error creating Daily.co room:', error);
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Failed to create video room' },
          { status: 500 }
        );
      }
    }

    // Create event in database
    const { data: event, error: eventError } = await supabase
      .from('chat_events')
      .insert({
        title,
        description,
        channel_id: channelId,
        event_type: eventType,
        host_id: hostId,
        guest_ids: guestIds || [],
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        status: 'scheduled',
        video_enabled: videoEnabled || false,
        daily_room_url: dailyRoomUrl,
        daily_room_name: dailyRoomName,
      })
      .select()
      .single();

    if (eventError || !event) {
      console.error('Error creating event:', eventError);
      
      // Cleanup Daily.co room if it was created
      if (dailyRoomName && process.env.DAILY_API_KEY) {
        try {
          await fetch(`https://api.daily.co/v1/rooms/${dailyRoomName}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
            },
          });
        } catch (cleanupError) {
          console.error('Error cleaning up Daily.co room:', cleanupError);
        }
      }

      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to create event' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<ChatEvent>>({
      success: true,
      data: {
        id: event.id,
        title: event.title,
        description: event.description,
        channelId: event.channel_id,
        eventType: event.event_type,
        hostId: event.host_id,
        guestIds: event.guest_ids,
        scheduledStart: new Date(event.scheduled_start),
        scheduledEnd: new Date(event.scheduled_end),
        status: event.status,
        videoEnabled: event.video_enabled,
        dailyRoomUrl: event.daily_room_url,
        dailyRoomName: event.daily_room_name,
        createdAt: new Date(event.created_at),
      },
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

/**
 * GET /api/events
 * Fetch events with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const supabase = createSupabaseAdmin();

    let query = supabase
      .from('chat_events')
      .select(`
        *,
        host:chat_users!host_id (
          id,
          display_name,
          alias,
          avatar,
          role
        )
      `)
      .order('scheduled_start', { ascending: false })
      .limit(limit);

    if (channelId) {
      query = query.eq('channel_id', channelId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    const formattedEvents: ChatEvent[] = events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      channelId: event.channel_id,
      eventType: event.event_type,
      hostId: event.host_id,
      guestIds: event.guest_ids,
      scheduledStart: new Date(event.scheduled_start),
      scheduledEnd: new Date(event.scheduled_end),
      status: event.status,
      videoEnabled: event.video_enabled,
      dailyRoomUrl: event.daily_room_url,
      dailyRoomName: event.daily_room_name,
      createdAt: new Date(event.created_at),
      host: event.host ? {
        id: event.host.id,
        address: '',
        displayName: event.host.alias || event.host.display_name,
        avatar: event.host.avatar,
        role: event.host.role,
        membershipTier: 'premium' as any,
        isBanned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } : undefined,
    }));

    return NextResponse.json<ApiResponse<ChatEvent[]>>({
      success: true,
      data: formattedEvents,
    });
  } catch (error) {
    console.error('Error in GET /api/events:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
