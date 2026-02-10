import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ApiResponse } from '@/types/chat';
import { getTownsBot } from '@/lib/towns/bot-instance';
import { getSpaceId, getParticipantRoleId } from '@/lib/towns/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/admin/events/end
 * 
 * Ends a live event and revokes messaging permissions from Participants.
 * 
 * Actions:
 * 1. Verify admin authorization
 * 2. Update event status to 'ended' in Supabase
 * 3. Revoke Write permission from Participants via Towns Protocol
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, adminAddress } = body;

    console.log('[POST /api/admin/events/end] Ending event:', eventId);

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
      console.log('[POST /api/admin/events/end] Unauthorized:', adminAddress);
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

    // Update event status to 'ended'
    const { error: updateError } = await supabase
      .from('chat_events')
      .update({ 
        status: 'ended',
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId);

    if (updateError) {
      console.error('[POST /api/admin/events/end] Error updating event:', updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update event status' },
        { status: 500 }
      );
    }

    console.log('[POST /api/admin/events/end] Event status updated to ended');

    // Revoke Write permission from Participants via Towns Protocol
    try {
      const bot = getTownsBot();
      const spaceId = getSpaceId();
      const participantRoleId = getParticipantRoleId();

      // Update the Participant role to only have Read permission
      await bot.updateRole(spaceId, participantRoleId, {
        permissions: ['Read'],
      });

      console.log('[POST /api/admin/events/end] Participant permissions revoked via Towns Protocol');
    } catch (townsError) {
      console.error('[POST /api/admin/events/end] Error updating Towns permissions:', townsError);
      // Don't fail the request if Towns update fails - event is still ended
      return NextResponse.json<ApiResponse<{ townsUpdateFailed: boolean }>>({
        success: true,
        data: { townsUpdateFailed: true },
        message: 'Event ended but failed to update Towns permissions. Please check Towns configuration.',
      });
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Event ended successfully. Participants can no longer message.',
    });

  } catch (error) {
    console.error('[POST /api/admin/events/end] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
