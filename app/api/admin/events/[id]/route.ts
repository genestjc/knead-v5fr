import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    const body = await req.json();
    const { adminAddress, status } = body;

    if (!adminAddress || !status) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;

    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS?.toLowerCase()) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdmin();

    const { error } = await supabase
      .from('chat_events')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', eventId);

    if (error) {
      console.error('Error updating event:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update event' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Event status updated',
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/events/[eventId]:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    if (!adminAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminAddress' },
        { status: 400 }
      );
    }

    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;

    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS?.toLowerCase()) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Get event to delete Daily.co room if exists
    const { data: event } = await supabase
      .from('chat_events')
      .select('daily_room_name')
      .eq('id', eventId)
      .single();

    // Delete Daily.co room if exists
    if (event?.daily_room_name) {
      try {
        await fetch(`https://api.daily.co/v1/rooms/${event.daily_room_name}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
          },
        });
      } catch (dailyError) {
        console.error('Error deleting Daily.co room:', dailyError);
      }
    }

    // Delete event from database
    const { error } = await supabase.from('chat_events').delete().eq('id', eventId);

    if (error) {
      console.error('Error deleting event:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to delete event' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Event deleted',
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/events/[eventId]:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
