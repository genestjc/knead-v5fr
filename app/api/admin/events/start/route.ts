import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ApiResponse } from '@/types/chat';
import { getTownsBot } from '@/lib/towns/bot-instance';
import { getSpaceId, getParticipantRoleId } from '@/lib/towns/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/admin/events/start
 * 
 * Starts a live event and grants messaging permissions to Participants.
 * 
 * Actions:
 * 1. Verify admin authorization
 * 2. Update event status to 'live' in Supabase
 * 3. Grant Write permission to Participants via Towns Protocol
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, adminAddress } = body;

    console.log('[POST /api/admin/events/start] Starting event:', eventId);

    // Validate inputs
    if (!eventId || !adminAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: eventId and adminAddress' },
        { status: 400 }
      );
    }

    // Verify admin authorization
    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;
    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS?.toLowerCase()) {
      console.log('[POST /api/admin/events/start] Unauthorized:', adminAddress);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create Supabase client
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

    // Update event status to 'live'
    const { error: updateError } = await supabase
      .from('chat_events')
      .update({ 
        status: 'live',
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId);

    if (updateError) {
      console.error('[POST /api/admin/events/start] Error updating event:', updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update event status' },
        { status: 500 }
      );
    }

    console.log('[POST /api/admin/events/start] Event status updated to live');

    // Grant Write permission to Participants via Towns Protocol
    try {
      const bot = getTownsBot();
      const spaceId = getSpaceId();
      const participantRoleId = getParticipantRoleId();

      // Update the Participant role to include Write permissions
      await bot.updateRole(spaceId, participantRoleId, {
        permissions: ['Read', 'Write', 'React'],
      });

      console.log('[POST /api/admin/events/start] Participant permissions updated via Towns Protocol');
    } catch (townsError) {
      console.error('[POST /api/admin/events/start] Error updating Towns permissions:', townsError);
      // Don't fail the request if Towns update fails - event is still live
      // The UI can show a warning and admin can manually fix permissions
      return NextResponse.json<ApiResponse<{ townsUpdateFailed: boolean }>>({
        success: true,
        data: { townsUpdateFailed: true },
        message: 'Event started but failed to update Towns permissions. Please check Towns configuration.',
      });
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Event started successfully. Participants can now message during the event.',
    });

  } catch (error) {
    console.error('[POST /api/admin/events/start] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
