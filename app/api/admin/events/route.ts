import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

// ============================================
// GET - Fetch all events (for admin panel)
// ============================================
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

    // ✅ DEBUG: Detailed JWT analysis
    const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log('[GET /api/admin/events] Raw service key length:', rawServiceKey?.length);
    console.log('[GET /api/admin/events] Raw service key first 100:', rawServiceKey?.substring(0, 100));
    console.log('[GET /api/admin/events] Raw service key last 50:', rawServiceKey?.substring(rawServiceKey!.length - 50));

    // Decode the JWT to check the role
    try {
      const parts = rawServiceKey?.split('.');
      if (parts && parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('[GET /api/admin/events] 🔑 JWT ROLE:', payload.role);
        console.log('[GET /api/admin/events] JWT issuer:', payload.iss);
        console.log('[GET /api/admin/events] JWT ref:', payload.ref);
      }
    } catch (e) {
      console.log('[GET /api/admin/events] ❌ Failed to decode JWT:', e);
    }

    console.log('[GET /api/admin/events] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

    const supabase = createSupabaseAdmin();

    // ✅ DEBUG: Try count first
    console.log('[GET /api/admin/events] Counting events...');
    const { count, error: countError } = await supabase
      .from('chat_events')
      .select('*', { count: 'exact', head: true });
    
    console.log('[GET /api/admin/events] Count result:', count);
    console.log('[GET /api/admin/events] Count error:', countError);

    // ✅ DEBUG: Fetch events with detailed logging
    console.log('[GET /api/admin/events] Fetching events...');
    const { data: events, error } = await supabase
      .from('chat_events')
      .select('*')
      .order('scheduled_start', { ascending: false });

    console.log('[GET /api/admin/events] Query completed');
    console.log('[GET /api/admin/events] Events is null:', events === null);
    console.log('[GET /api/admin/events] Events is array:', Array.isArray(events));
    console.log('[GET /api/admin/events] Events length:', events?.length);
    console.log('[GET /api/admin/events] Error:', error);
    console.log('[GET /api/admin/events] First event:', events?.[0]);

    if (error) {
      console.error('[GET /api/admin/events] Error fetching events:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Failed to fetch events: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('[GET /api/admin/events] Found events:', events?.length || 0);

    if (!events || events.length === 0) {
      console.log('[GET /api/admin/events] ⚠️ WARNING: Returning empty array despite DB having events!');
      return NextResponse.json<ApiResponse<any>>({
        success: true,
        data: [],
      });
    }

    // Fetch host and guest data for each event
    const eventsWithUsers = await Promise.all(
      events.map(async (event) => {
        console.log('[GET /api/admin/events] Processing event ID:', event.id);
        
        let host = null;
        if (event.host_id) {
          const { data: hostData, error: hostError } = await supabase
            .from('chat_users')
            .select('id, address, display_name, alias')
            .eq('id', event.host_id)
            .single();

          if (hostError) {
            console.error('[GET /api/admin/events] Error fetching host:', hostError);
          } else {
            host = hostData;
          }
        }

        let guests = [];
        if (event.guest_ids && Array.isArray(event.guest_ids) && event.guest_ids.length > 0) {
          const { data: guestData, error: guestError } = await supabase
            .from('chat_users')
            .select('id, address, display_name, alias')
            .in('id', event.guest_ids);

          if (guestError) {
            console.error('[GET /api/admin/events] Error fetching guests:', guestError);
          } else {
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

    console.log('[GET /api/admin/events] Returning', eventsWithUsers.length, 'events');

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
