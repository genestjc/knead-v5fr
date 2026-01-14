import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyAdminByAddress } from '@/lib/middleware/admin';
import type { ApiResponse, ChatEvent } from '@/types/chat';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events
 * List all events (admin only)
 */
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

    // Verify admin permissions using middleware
    const { user, error } = await verifyAdminByAddress(adminAddress);
    
    if (error || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error || 'User not found' },
        { status: error === 'Insufficient permissions' ? 403 : 404 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch all events with host and guest details
    const { data: events, error: fetchError } = await supabase
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
      .order('scheduled_start', { ascending: false });

    if (fetchError) {
      logger.error('Error fetching events:', fetchError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    // Fetch guest details for each event
    const eventsWithGuests = await Promise.all(
      events.map(async (event) => {
        if (event.guest_ids && event.guest_ids.length > 0) {
          const { data: guests } = await supabase
            .from('chat_users')
            .select('id, display_name, alias, avatar, role')
            .in('id', event.guest_ids);

          return { ...event, guests: guests || [] };
        }
        return { ...event, guests: [] };
      })
    );

    const formattedEvents = eventsWithGuests.map((event) => ({
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
        displayName: event.host.alias || event.host.display_name,
        avatar: event.host.avatar,
        role: event.host.role,
      } : undefined,
      guests: event.guests.map((g: any) => ({
        id: g.id,
        displayName: g.alias || g.display_name,
        avatar: g.avatar,
        role: g.role,
      })),
    }));

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: formattedEvents,
    });
  } catch (error) {
    logger.error('Error in GET /api/admin/events:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/events
 * Update event (start/stop, update open period)
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminAddress, eventId, updates } = body;

    if (!adminAddress || !eventId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: adminAddress, eventId' },
        { status: 400 }
      );
    }

    // Verify admin permissions using middleware
    const { user, error } = await verifyAdminByAddress(adminAddress);
    
    if (error || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error || 'User not found' },
        { status: error === 'Insufficient permissions' ? 403 : 404 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Update event
    const { data: event, error: updateError } = await supabase
      .from('chat_events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();

    if (updateError || !event) {
      logger.error('Error updating event:', updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update event' },
        { status: 500 }
      );
    }

    // If status changed to 'live', update channel's isOpenPeriod
    if (updates.status === 'live' && event.channel_id === 'live-interviews') {
      // Note: Channel open period is managed via event status
      // The chat-test page should check for active live events
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
      message: 'Event updated successfully',
    });
  } catch (error) {
    logger.error('Error in PATCH /api/admin/events:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
