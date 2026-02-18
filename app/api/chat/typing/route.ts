import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/typing
 * Update typing indicator (upserts with current timestamp)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, channelId, isTyping } = body;

    if (!userId || !channelId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: userId, channelId' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    if (isTyping) {
      // Upsert typing indicator with current timestamp
      const { error } = await supabase
        .from('typing_indicators')
        .upsert({
          user_id: userId,
          channel_id: channelId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,channel_id',
        });

      if (error) {
        console.error('Error updating typing indicator:', error);
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Failed to update typing indicator' },
          { status: 500 }
        );
      }
    } else {
      // Remove typing indicator
      const { error } = await supabase
        .from('typing_indicators')
        .delete()
        .eq('user_id', userId)
        .eq('channel_id', channelId);

      if (error) {
        console.error('Error removing typing indicator:', error);
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Failed to remove typing indicator' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
    });
  } catch (error) {
    console.error('Error in POST /api/chat/typing:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/typing
 * Get active typers in a channel (last 10 seconds)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing channelId parameter' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Get typing indicators from last 10 seconds
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();

    const { data, error } = await supabase
      .from('typing_indicators')
      .select(`
        user_id,
        chat_users!inner (
          id,
          address,
          alias,
          avatar
        )
      `)
      .eq('channel_id', channelId)
      .gte('updated_at', tenSecondsAgo);

    if (error) {
      console.error('Error fetching typing indicators:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch typing indicators' },
        { status: 500 }
      );
    }

    const typers = data.map((item) => ({
      userId: item.user_id,
      displayName: item.chat_users.alias || `${item.chat_users.address.slice(0, 6)}...${item.chat_users.address.slice(-4)}`,
      avatar: item.chat_users.avatar,
    }));

    return NextResponse.json<ApiResponse<Array<{ userId: string; displayName: string; avatar?: string }>>>({
      success: true,
      data: typers,
    });
  } catch (error) {
    console.error('Error in GET /api/chat/typing:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
