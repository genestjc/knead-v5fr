import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isAdmin } from '@/lib/chat/permissions';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/moderation
 * Get flagged messages and recent moderation logs (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminId parameter' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify admin permissions
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('id', adminId)
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
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get flagged messages (high moderation scores or manually flagged)
    const { data: flaggedMessages, error: flaggedError } = await supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        created_at,
        moderation_score,
        moderation_categories,
        is_hidden,
        channel_id,
        chat_users!inner (
          id,
          display_name,
          alias,
          address
        )
      `)
      .gte('moderation_score', 0.7)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (flaggedError) {
      console.error('Error fetching flagged messages:', flaggedError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch flagged messages' },
        { status: 500 }
      );
    }

    // Get recent moderation logs
    const { data: logs, error: logsError } = await supabase
      .from('moderation_logs')
      .select(`
        id,
        message_id,
        admin_id,
        action,
        reason,
        created_at,
        chat_users!admin_id (
          display_name,
          alias
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (logsError) {
      console.error('Error fetching moderation logs:', logsError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch moderation logs' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: {
        flaggedMessages: flaggedMessages.map((msg) => ({
          id: msg.id,
          content: msg.content,
          createdAt: msg.created_at,
          moderationScore: msg.moderation_score,
          moderationCategories: msg.moderation_categories,
          isHidden: msg.is_hidden,
          channelId: msg.channel_id,
          user: {
            id: msg.chat_users.id,
            displayName: msg.chat_users.alias || msg.chat_users.display_name,
            address: msg.chat_users.address,
          },
        })),
        logs: logs.map((log) => ({
          id: log.id,
          messageId: log.message_id,
          action: log.action,
          reason: log.reason,
          createdAt: log.created_at,
          adminName: log.chat_users?.alias || log.chat_users?.display_name,
        })),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/moderation:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/moderation
 * Hide/unhide messages and log moderation actions (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminId, messageId, action, reason } = body;

    if (!adminId || !messageId || !action) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: adminId, messageId, action' },
        { status: 400 }
      );
    }

    const validActions = ['hide', 'unhide'];
    if (!validActions.includes(action)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify admin permissions
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('id', adminId)
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
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Update message visibility
    const isHidden = action === 'hide';
    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({ is_hidden: isHidden })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error updating message:', updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update message' },
        { status: 500 }
      );
    }

    // Log the moderation action
    const { error: logError } = await supabase
      .from('moderation_logs')
      .insert({
        message_id: messageId,
        admin_id: adminId,
        action: action,
        reason: reason || null,
      });

    if (logError) {
      console.error('Error logging moderation action:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: `Message ${action === 'hide' ? 'hidden' : 'unhidden'} successfully`,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/moderation:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
