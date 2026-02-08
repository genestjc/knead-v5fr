import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    console.log('[GET /api/admin/events] Admin address:', adminAddress);

    if (!adminAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminAddress parameter' },
        { status: 400 }
      );
    }

    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;

    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS?.toLowerCase()) {
      console.log('[GET /api/admin/events] Unauthorized:', adminAddress);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdmin();

    // ✅ TEST 1: Check what role we're using
    console.log('[GET /api/admin/events] === TEST 1: Auth Context ===');
    const { data: jwtData, error: jwtError } = await supabase.rpc('test_auth_context');
    console.log('[GET /api/admin/events] JWT Data:', jwtData);
    console.log('[GET /api/admin/events] JWT Error:', jwtError);

    // ✅ TEST 2: Try RPC to bypass PostgREST
    console.log('[GET /api/admin/events] === TEST 2: RPC Bypass ===');
    const { data: rpcEvents, error: rpcError } = await supabase.rpc('admin_get_chat_events');
    console.log('[GET /api/admin/events] RPC Events Count:', rpcEvents?.length);
    console.log('[GET /api/admin/events] RPC Error:', rpcError);
    console.log('[GET /api/admin/events] RPC First Event:', rpcEvents?.[0]);

    // ✅ Original count test
    console.log('[GET /api/admin/events] === TEST 3: Original Count ===');
    const { count, error: countError } = await supabase
      .from('chat_events')
      .select('*', { count: 'exact', head: true });
    
    console.log('[GET /api/admin/events] Count result:', count);
    console.log('[GET /api/admin/events] Count error:', countError);

    // ✅ Original select test
    console.log('[GET /api/admin/events] === TEST 4: Original Select ===');
    const { data: events, error } = await supabase
      .from('chat_events')
      .select('*')
      .order('scheduled_start', { ascending: false });

    console.log('[GET /api/admin/events] Events length:', events?.length);
    console.log('[GET /api/admin/events] Error:', error);
    console.log('[GET /api/admin/events] First event:', events?.[0]);

    // ✅ If RPC worked but SELECT didn't, use RPC results
    if (rpcEvents && rpcEvents.length > 0 && (!events || events.length === 0)) {
      console.log('[GET /api/admin/events] ⚠️ Using RPC results because SELECT failed');
      
      // Return RPC results (simplified, without user lookups for now)
      const simplifiedEvents = rpcEvents.map((event: any) => ({
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
        host: null, // TODO: fetch host data
        guests: [],  // TODO: fetch guest data
        createdAt: event.created_at,
      }));

      return NextResponse.json<ApiResponse<any>>({
        success: true,
        data: simplifiedEvents,
      });
    }

    if (error) {
      console.error('[GET /api/admin/events] Error fetching events:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Failed to fetch events: ${error.message}` },
        { status: 500 }
      );
    }

    if (!events || events.length === 0) {
      console.log('[GET /api/admin/events] ⚠️ WARNING: Returning empty array');
      return NextResponse.json<ApiResponse<any>>({
        success: true,
        data: [],
      });
    }

    // Fetch host and guest data for each event
    const eventsWithUsers = await Promise.all(
      events.map(async (event) => {
        let host = null;
        if (event.host_id) {
          const { data: hostData, error: hostError } = await supabase
            .from('chat_users')
            .select('id, address, display_name, alias')
            .eq('id', event.host_id)
            .single();

          if (!hostError) {
            host = hostData;
          }
        }

        let guests = [];
        if (event.guest_ids && Array.isArray(event.guest_ids) && event.guest_ids.length > 0) {
          const { data: guestData, error: guestError } = await supabase
            .from('chat_users')
            .select('id, address, display_name, alias')
            .in('id', event.guest_ids);

          if (!guestError) {
            guests = guestData || [];
          }
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
          host: host ? {
            id: host.id,
            address: host.address,
            displayName: host.display_name,
            alias: host.alias,
          } : null,
          guests: guests.map((g) => ({
            id: g.id,
            address: g.address,
            displayName: g.display_name,
            alias: g.alias,
          })),
          createdAt: event.created_at,
        };
      })
    );

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: eventsWithUsers,
    });
  } catch (error) {
    console.error('[GET /api/admin/events] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
