import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // ✅ Direct import
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ============================================
// PATCH - Update event status
// ============================================
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await context.params;
    
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

    // ✅ CREATE FRESH CLIENT
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

    // ✅ NEW: Return permission update instructions for client
    const needsPermissionUpdate = status === 'live' || status === 'ended';

    // Validate required environment variables
    if (needsPermissionUpdate) {
      if (!process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID) {
        console.error('[PATCH /api/admin/events] Missing NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID');
      }
      if (!process.env.TOWNS_PARTICIPANT_ROLE_ID) {
        console.error('[PATCH /api/admin/events] Missing TOWNS_PARTICIPANT_ROLE_ID');
      }
    }

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      message: 'Event status updated',
      needsPermissionUpdate,
      roleUpdate: needsPermissionUpdate ? {
        spaceId: process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID,
        roleId: parseInt(process.env.TOWNS_PARTICIPANT_ROLE_ID || '0'),
        permissions: status === 'live' 
          ? ['Read', 'Write', 'React'] // Grant messaging during event
          : ['Read'] // View-only when ended
      } : undefined
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
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await context.params;
    
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

    // ✅ CREATE FRESH CLIENT
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
