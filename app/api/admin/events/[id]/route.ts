import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

// ============================================
// PATCH - Update event status
// ============================================
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    
    if (!eventId || eventId === 'undefined' || eventId === 'null') {
      console.error('[PATCH /api/admin/events] Invalid eventId:', eventId);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid event ID' },
        { status: 400 }
      );
    }
    
    const body = await req.json();
    const { adminAddress, status } = body;

    console.log('[PATCH /api/admin/events] Updating event:', eventId, 'to status:', status);

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
      .update({ 
        status, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', eventId);

    if (error) {
      console.error('[PATCH /api/admin/events] Error updating event:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update event' },
        { status: 500 }
      );
    }

    console.log('[PATCH /api/admin/events] Event updated successfully');

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Event status updated',
    });
  } catch (error) {
    console.error('[PATCH /api/admin/events] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete event
// ============================================
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    
    if (!eventId || eventId === 'undefined' || eventId === 'null') {
      console.error('[DELETE /api/admin/events] Invalid eventId:', eventId);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid event ID' },
        { status: 400 }
      );
    }
    
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    console.log('[DELETE /api/admin/events] Deleting event:', eventId);

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
      .select('daily_room_name, video_enabled')
      .eq('id', eventId)
      .single();

    // Delete Daily.co room if exists
    if (event?.daily_room_name && event?.video_enabled && process.env.DAILY_API_KEY) {
      try {
        console.log('[DELETE /api/admin/events] Deleting Daily.co room:', event.daily_room_name);
        
        const dailyResponse = await fetch(`https://api.daily.co/v1/rooms/${event.daily_room_name}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
          },
        });

        if (dailyResponse.ok) {
          console.log('[DELETE /api/admin/events] Daily.co room deleted');
        } else {
          console.error('[DELETE /api/admin/events] Failed to delete Daily.co room');
        }
      } catch (dailyError) {
        console.error('[DELETE /api/admin/events] Error deleting Daily.co room:', dailyError);
      }
    }

    // Delete event from database
    const { error: deleteError } = await supabase
      .from('chat_events')
      .delete()
      .eq('id', eventId);

    if (deleteError) {
      console.error('[DELETE /api/admin/events] Error deleting event:', deleteError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to delete event' },
        { status: 500 }
      );
    }

    console.log('[DELETE /api/admin/events] Event deleted successfully');

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Event deleted',
    });
  } catch (error) {
    console.error('[DELETE /api/admin/events] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
