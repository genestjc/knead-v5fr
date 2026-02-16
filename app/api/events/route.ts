import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { createOnChainEvent, EventType } from '@/lib/blockchain/event-management';
import type { ApiResponse } from '@/types/chat';

// Constants
const DEFAULT_RSVP_CAP = 999999; // Default max participants for events

export const dynamic = 'force-dynamic';

// ============================================
// GET - Fetch events (for chat to check live events)
// ============================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    console.log('[GET /api/events] Fetching events with status:', status);

    const supabase = createSupabaseAdmin();

    let query = supabase
      .from('chat_events')
      .select('*')
      .order('scheduled_start', { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('[GET /api/events] Error:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    console.log('[GET /api/events] Found events:', events?.length || 0);

    if (!events || events.length === 0) {
      return NextResponse.json<ApiResponse<any>>({
        success: true,
        data: [],
      });
    }

    // Fetch host and guest data
    const eventsWithUsers = await Promise.all(
      events.map(async (event) => {
        // Fetch host
        let host = null;
        if (event.host_id) {
          const { data: hostData } = await supabase
            .from('chat_users')
            .select('id, address, display_name, alias, avatar')
            .eq('id', event.host_id)
            .single();
          host = hostData;
        }

        // Fetch guests
        let guests = [];
        if (event.guest_ids && Array.isArray(event.guest_ids) && event.guest_ids.length > 0) {
          const { data: guestData } = await supabase
            .from('chat_users')
            .select('id, address, display_name, alias, avatar')
            .in('id', event.guest_ids);
          guests = guestData || [];
        }

        return {
          id: event.id,
          title: event.title,
          description: event.description,
          channelId: event.channel_id,
          eventType: event.event_type,
          scheduledStart: event.scheduled_start,
          scheduledEnd: event.scheduled_end,
          status: event.status,
          videoEnabled: event.video_enabled,
          dailyRoomUrl: event.daily_room_url,
          dailyRoomName: event.daily_room_name,
          host: host
            ? {
                id: host.id,
                address: host.address,
                displayName: host.display_name,
                alias: host.alias,
                avatar: host.avatar,
              }
            : null,
          guests: guests.map((g) => ({
            id: g.id,
            address: g.address,
            displayName: g.display_name,
            alias: g.alias,
            avatar: g.avatar,
          })),
          createdAt: event.created_at,
          updatedAt: event.updated_at,
        };
      })
    );

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: eventsWithUsers,
    });
  } catch (error) {
    console.error('[GET /api/events] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create event
// ============================================
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

    // ✅ ADD SERVER-SIDE DEBUG LOGGING
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 [POST /api/events] REQUEST RECEIVED');
    console.log('   Title:', title);
    console.log('   Host ID:', hostId);
    console.log('   Guest IDs from request:', guestIds);
    console.log('   Guest IDs type:', Array.isArray(guestIds) ? 'Array' : typeof guestIds);
    console.log('   Guest IDs length:', guestIds.length);
    console.log('   Guest IDs stringified:', JSON.stringify(guestIds));
    console.log('   Video Enabled:', videoEnabled);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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

    // ✅ VERIFY GUESTS EXIST (if provided)
    if (guestIds.length > 0) {
      console.log('🔍 [POST /api/events] Verifying guests exist...');
      const { data: guests, error: guestError } = await supabase
        .from('chat_users')
        .select('id, address, display_name, alias')
        .in('id', guestIds);
      
      console.log('   Found guests:', guests);
      console.log('   Guest error:', guestError);
      
      if (guestError) {
        console.error('❌ [POST /api/events] Error fetching guests:', guestError);
      }
      
      if (!guests || guests.length !== guestIds.length) {
        console.warn('⚠️ [POST /api/events] Some guests not found in database!');
        console.warn('   Requested:', guestIds.length, 'Found:', guests?.length || 0);
      }
    }

    // Create Daily.co room if video is enabled
    let dailyRoomUrl = null;
    let dailyRoomName = null;

    if (videoEnabled && process.env.DAILY_API_KEY) {
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
          console.log('[POST /api/events] Created Daily.co room:', dailyRoomName);
        } else {
          console.error('[POST /api/events] Failed to create Daily.co room:', await dailyResponse.text());
        }
      } catch (dailyError) {
        console.error('[POST /api/events] Error creating Daily.co room:', dailyError);
      }
    }

    // Create on-chain event for Live/Discussion events
    if (eventType === 'live' || eventType === 'discussion') {
      try {
        const startTimestamp = Math.floor(new Date(scheduledStart).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(scheduledEnd).getTime() / 1000);
        const chainEventType = eventType === 'live' ? EventType.Live : EventType.Discussion;
        
        await createOnChainEvent(
          title,
          startTimestamp,
          endTimestamp,
          chainEventType,
          DEFAULT_RSVP_CAP
        );
        
        console.log('[POST /api/events] Created on-chain event for:', title);
      } catch (chainError) {
        console.error('[POST /api/events] Error creating on-chain event:', chainError);
      }
    }

    // ✅ INSERT EVENT WITH DEBUG LOGGING
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 [POST /api/events] INSERTING INTO DATABASE');
    console.log('   guest_ids to insert:', guestIds);
    console.log('   guest_ids type:', Array.isArray(guestIds) ? 'Array' : typeof guestIds);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 [POST /api/events] INSERT RESULT');
    console.log('   Success:', !insertError);
    console.log('   Error:', insertError);
    console.log('   Returned event:', event);
    console.log('   Returned guest_ids:', event?.guest_ids);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (insertError) {
      console.error('[POST /api/events] Error creating event:', insertError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to create event' },
        { status: 500 }
      );
    }

    console.log('[POST /api/events] Event created successfully:', event.id);

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: event,
      message: 'Event created successfully',
    });
  } catch (error) {
    console.error('[POST /api/events] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
