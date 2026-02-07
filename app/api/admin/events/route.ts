import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    if (!adminAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminAddress parameter' },
        { status: 400 }
      );
    }

    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;

    // Verify admin
    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS?.toLowerCase()) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Fetch events
    const { data: events, error } = await supabase
      .from('chat_events')
      .select('*')
      .order('scheduled_start', { ascending: false });

    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    // Fetch host and guest data for each event
    const eventsWithUsers = await Promise.all(
      events.map(async (event) => {
        // Fetch host
        const { data: host } = await supabase
          .from('chat_users')
          .select('id, address, display_name, alias')
          .eq('id', event.host_id)
          .single();

        // Fetch guests
        let guests = [];
        if (event.guest_ids && event.guest_ids.length > 0) {
          const { data: guestData } = await supabase
            .from('chat_users')
            .select('id, address, display_name, alias')
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
              }
            : null,
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
    console.error('Error in GET /api/admin/events:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
