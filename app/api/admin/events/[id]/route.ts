import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isAdmin } from '@/lib/chat/permissions';
import type { ApiResponse, ChatEvent } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events/[id]
 * Get single event details (admin only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    if (!adminAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminAddress parameter' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify admin permissions
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('address', adminAddress.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const chatUser = {
      id: user.id,
      address: user.address,
      displayName: user.display_name,
      avatar: user.avatar,
      role: user.role,
      membershipTier: user.membership_tier,
      contributorType: user.contributor_type,
      isBanned: user.is_banned,
      bio: user.bio,
      alias: user.alias,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    };

    if (!isAdmin(chatUser)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Insufficient permissions - admin only' },
        { status: 403 }
      );
    }

    // Fetch event
    const { data: event, error } = await supabase
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
      .eq('id', params.id)
      .single();

    if (error || !event) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Fetch guests
    let guests: any[] = [];
    if (event.guest_ids && event.guest_ids.length > 0) {
      const { data: guestsData } = await supabase
        .from('chat_users')
        .select('id, display_name, alias, avatar, role')
        .in('id', event.guest_ids);
      guests = guestsData || [];
    }

    const formattedEvent: ChatEvent = {
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
    };

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: {
        ...formattedEvent,
        guests: guests.map((g) => ({
          id: g.id,
          displayName: g.alias || g.display_name,
          avatar: g.avatar,
          role: g.role,
        })),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[id]:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/events/[id]
 * Update specific event (admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { adminAddress, ...updates } = body;

    if (!adminAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminAddress' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify admin permissions
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('address', adminAddress.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const chatUser = {
      id: user.id,
      address: user.address,
      displayName: user.display_name,
      avatar: user.avatar,
      role: user.role,
      membershipTier: user.membership_tier,
      contributorType: user.contributor_type,
      isBanned: user.is_banned,
      bio: user.bio,
      alias: user.alias,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    };

    if (!isAdmin(chatUser)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Insufficient permissions - admin only' },
        { status: 403 }
      );
    }

    // Update event
    const { data: event, error: updateError } = await supabase
      .from('chat_events')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError || !event) {
      console.error('Error updating event:', updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update event' },
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
      message: 'Event updated successfully',
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/events/[id]:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/events/[id]
 * Delete event (admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    if (!adminAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminAddress parameter' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify admin permissions
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('address', adminAddress.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const chatUser = {
      id: user.id,
      address: user.address,
      displayName: user.display_name,
      avatar: user.avatar,
      role: user.role,
      membershipTier: user.membership_tier,
      contributorType: user.contributor_type,
      isBanned: user.is_banned,
      bio: user.bio,
      alias: user.alias,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    };

    if (!isAdmin(chatUser)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Insufficient permissions - admin only' },
        { status: 403 }
      );
    }

    // Get event to check for Daily.co room
    const { data: event } = await supabase
      .from('chat_events')
      .select('daily_room_name')
      .eq('id', params.id)
      .single();

    // Delete Daily.co room if it exists
    if (event?.daily_room_name && process.env.DAILY_API_KEY) {
      try {
        await fetch(`https://api.daily.co/v1/rooms/${event.daily_room_name}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
          },
        });
      } catch (error) {
        console.error('Error deleting Daily.co room:', error);
        // Continue with event deletion even if Daily.co cleanup fails
      }
    }

    // Delete event
    const { error: deleteError } = await supabase
      .from('chat_events')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('Error deleting event:', deleteError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to delete event' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/events/[id]:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
