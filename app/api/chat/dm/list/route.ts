import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';
/**
 * GET /api/chat/dm/list?userId=xxx
 * 
 * Get list of all DM conversations for a user
 * - Returns DM metadata
 * - Includes other participant info
 * - Ordered by most recent activity
 */
export async function GET(req: NextRequest) {
  try {
    // Initialize Supabase client inside the function
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    // Get all DMs where user is participant
    const { data: dms, error: dmsError } = await supabase
      .from('chat_dms')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (dmsError) {
      throw dmsError;
    }

    if (!dms || dms.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No DM conversations found',
      });
    }

    // Get info about other participants
    const otherUserIds = dms.map(dm => 
      dm.user_a === userId ? dm.user_b : dm.user_a
    );

    const { data: otherUsers, error: usersError } = await supabase
      .from('chat_users')
      .select('id, wallet_address, role')
      .in('id', otherUserIds);

    if (usersError) {
      throw usersError;
    }

    // Map users to DMs
    const dmsWithUsers = dms.map(dm => {
      const otherUserId = dm.user_a === userId ? dm.user_b : dm.user_a;
      const otherUser = otherUsers?.find(u => u.id === otherUserId);

      return {
        id: dm.id,
        towns_dm_id: dm.towns_dm_id,
        created_at: dm.created_at,
        last_message_at: dm.last_message_at,
        other_user: otherUser ? {
          id: otherUser.id,
          wallet_address: otherUser.wallet_address,
          role: otherUser.role,
          display_name: otherUser.wallet_address.slice(0, 6) + '...' + otherUser.wallet_address.slice(-4),
        } : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: dmsWithUsers,
    });

  } catch (error) {
    console.error('Get DM list error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get DM list',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
