import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { createOnChainEvent, EventType } from '@/lib/blockchain/event-management';
import { formatAddressForDisplay } from '@/lib/utils/transformers';
import type { ApiResponse } from '@/types/chat';

const DEFAULT_RSVP_CAP = 999999;

export const dynamic = 'force-dynamic';

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

    const eventsWithUsers = await Promise.all(
      events.map(async (event) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[GET /api/events] Processing event:', event.title);
        console.log('   Event ID:', event.id);
        console.log('   guest_addresses from DB:', event.guest_addresses);
        console.log('   guest_only_event:', event.guest_only_event);
        console.log('   music_mode:', event.music_mode);
        
        let host = null;
        if (event.host_id) {
          const { data: hostData } = await supabase
            .from('chat_users')
            .select('id, address, alias, avatar')
            .eq('id', event.host_id)
            .single();
          host = hostData;
          console.log('   Host:', host?.address || 'not found');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
          guestOnlyEvent: event.guest_only_event || false,
          musicMode: event.music_mode || false,
          host: host
            ? {
                id: host.id,
                address: host.address,
                displayName: host.alias || formatAddressForDisplay(host.address),
                alias: host.alias,
                avatar: host.avatar,
              }
            : null,
          guestAddresses: event.guest_addresses || [],
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
      guestAddresses = [],
      guestOnlyEvent = false,
      musicMode = false, // ✅ ADDED
    } = body;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 [POST /api/events] Creating event');
    console.log('   Title:', title);
    console.log('   Guest addresses received:', guestAddresses);
    console.log('   Guest-only event:', guestOnlyEvent);
    console.log('   Music mode:', musicMode); // ✅ ADDED
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!title || !channelId || !eventType || !hostId || !scheduledStart || !scheduledEnd) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: `Missing required fields`,
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

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

    const normalizedGuestAddresses = guestAddresses.map((addr: string) => 
      addr.toLowerCase()
    );
    
    console.log('📝 Normalized guest addresses:', normalizedGuestAddresses);

    let dailyRoomUrl = null;
    let dailyRoomName = null;

    if (videoEnabled && process.env.DAILY_API_KEY) {
      try {
        // ✅ Build room properties with optional music mode
        const roomProperties: any = {
          owner_only_broadcast: true,
          enable_screenshare: true,
          enable_chat: false,
          enable_prejoin_ui: false,
          start_video_off: false,
          start_audio_off: false,
          max_participants: 100,
        };

        // ✅ Add music mode settings if enabled
        if (musicMode) {
          roomProperties.enable_advanced_audio = true;
          roomProperties.audio_codec = 'opus';
          roomProperties.opus_params = {
            maxaveragebitrate: 510000, // Studio quality
            stereo: true,
            useinbandfec: true,
            usedtx: false,
          };
          console.log('🎵 Music mode enabled for this event');
        }

        const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: `knead-event-${Date.now()}`,
            properties: roomProperties,
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

    console.log('💾 Inserting event with guest_addresses:', normalizedGuestAddresses);
    
    const { data: event, error: insertError } = await supabase
      .from('chat_events')
      .insert({
        title,
        description,
        channel_id: channelId,
        event_type: eventType,
        host_id: hostId,
        guest_addresses: normalizedGuestAddresses,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        status: 'scheduled',
        video_enabled: videoEnabled,
        daily_room_url: dailyRoomUrl,
        daily_room_name: dailyRoomName,
        guest_only_event: guestOnlyEvent,
        music_mode: musicMode, // ✅ ADDED
      })
      .select()
      .single();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 INSERT RESULT');
    console.log('   Success:', !insertError);
    console.log('   Event created with guest_addresses:', event?.guest_addresses);
    console.log('   Guest count:', event?.guest_addresses?.length || 0);
    console.log('   Guest-only event:', event?.guest_only_event);
    console.log('   Music mode:', event?.music_mode); // ✅ ADDED
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
