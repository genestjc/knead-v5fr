import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    console.log('[GET /api/admin/events-fresh] Admin address:', adminAddress);

    if (!adminAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminAddress parameter' },
        { status: 400 }
      );
    }

    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;

    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS?.toLowerCase()) {
      console.log('[GET /api/admin/events-fresh] Unauthorized:', adminAddress);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdmin();

    console.log('[GET /api/admin/events-fresh] Fetching events directly from table...');
    const { data: events, error } = await supabase
      .from('chat_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/admin/events-fresh] Error fetching events:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Failed to fetch events: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('[GET /api/admin/events-fresh] Found events:', events?.length || 0);

    if (!events || events.length === 0) {
      return NextResponse.json<ApiResponse<any>>(
        {
          success: true,
          data: [],
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }

    const eventsWithUsers = await Promise.all(
      events.map(async (event: any) => {
        let host = null;
        if (event.host_id) {
          const { data: hostData } = await supabase
            .from('chat_users')
            .select('id, address, alias')
            .eq('id', event.host_id)
            .single();
          host = hostData;
        }

        let guests = [];
        if (event.guest_ids && Array.isArray(event.guest_ids) && event.guest_ids.length > 0) {
          const { data: guestData } = await supabase
            .from('chat_users')
            .select('id, address, alias')
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
                displayName: host.alias || `${host.address.slice(0, 6)}...${host.address.slice(-4)}`,
                alias: host.alias,
              }
            : null,
          guests: guests.map((g) => ({
            id: g.id,
            address: g.address,
            displayName: g.alias || `${g.address.slice(0, 6)}...${g.address.slice(-4)}`,
            alias: g.alias,
          })),
          createdAt: event.created_at,
        };
      })
    );

    console.log('[GET /api/admin/events-fresh] Returning', eventsWithUsers.length, 'events');

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: eventsWithUsers,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('[GET /api/admin/events-fresh] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
