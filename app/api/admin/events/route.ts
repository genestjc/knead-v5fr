import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // ✅ Direct import
import { formatAddressForDisplay } from '@/lib/utils/transformers';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type EventParticipant = {
  id: string;
  address: string;
  alias: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req, { requireMaster: true });
    if (!auth.ok) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // ✅ CREATE FRESH CLIENT - DON'T USE SINGLETON
    console.log('[GET /api/admin/events] Creating FRESH Supabase client (no cache)...');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    console.log('[GET /api/admin/events] Fetching events...');
    const { data: events, error } = await supabase
      .from('chat_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/admin/events] Error:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Failed to fetch events: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('[GET /api/admin/events] Event IDs:', events?.map(e => e.id));
    console.log('[GET /api/admin/events] Event titles:', events?.map(e => e.title));

    if (!events || events.length === 0) {
      return NextResponse.json<ApiResponse<any>>(
        { success: true, data: [] },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }

    // Fetch host and guest data for each event
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

        let guests: EventParticipant[] = [];
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
          guestAddresses: event.guest_addresses || [],
          guestOnlyEvent: event.guest_only_event || false,
          musicMode: event.music_mode || false,
          eventPassOnly: event.event_pass_only || false,
          muxPlaybackId: event.mux_playback_id || null,
          muxAssetId: event.mux_asset_id || null,
          host: host
            ? {
                id: host.id,
                address: host.address,
                displayName: host.alias || formatAddressForDisplay(host.address),
                alias: host.alias,
              }
            : null,
          guests: guests.map((g) => ({
            id: g.id,
            address: g.address,
            displayName: g.alias || formatAddressForDisplay(g.address),
            alias: g.alias,
          })),
          createdAt: event.created_at,
        };
      })
    );

    console.log('[GET /api/admin/events] Returning', eventsWithUsers.length, 'events');

    return NextResponse.json<ApiResponse<any>>(
      { success: true, data: eventsWithUsers },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('[GET /api/admin/events] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
