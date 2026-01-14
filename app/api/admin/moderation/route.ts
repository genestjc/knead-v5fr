import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { verifyAdminPermissionsById } from '@/lib/chat/middleware';
import { logger } from '@/lib/logger';
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

    // Use shared middleware for admin verification
    const verification = await verifyAdminPermissionsById(adminId);
    if (!verification.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: verification.error || 'Unauthorized' },
        { status: verification.error === 'User not found' ? 404 : 403 }
      );
    }

    const supabase = createSupabaseAdmin();

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
      logger.error('Error fetching flagged messages:', flaggedError);
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
      logger.error('Error fetching moderation logs:', logsError);
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
    logger.error('Error in GET /api/admin/moderation:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/moderation
 * Hide/unhide messages, ban users, and log moderation actions (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminId, messageId, userId, action, reason } = body;

    if (!adminId || !action) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: adminId, action' },
        { status: 400 }
      );
    }

    const validActions = ['hide', 'unhide', 'ban', 'unban'];
    if (!validActions.includes(action)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    if (['hide', 'unhide'].includes(action) && !messageId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'messageId required for hide/unhide actions' },
        { status: 400 }
      );
    }

    if (['ban', 'unban'].includes(action) && !userId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'userId required for ban/unban actions' },
        { status: 400 }
      );
    }

    // Use shared middleware for admin verification
    const verification = await verifyAdminPermissionsById(adminId);
    if (!verification.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: verification.error || 'Unauthorized' },
        { status: verification.error === 'User not found' ? 404 : 403 }
      );
    }

    const supabase = createSupabaseAdmin();
    let actionMessage = '';

    // Handle message hide/unhide
    if (action === 'hide' || action === 'unhide') {
      const isHidden = action === 'hide';
      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ is_hidden: isHidden })
        .eq('id', messageId);

      if (updateError) {
        logger.error('Error updating message:', updateError);
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Failed to update message' },
          { status: 500 }
        );
      }

      // Log the moderation action
      await supabase
        .from('moderation_logs')
        .insert({
          message_id: messageId,
          admin_id: adminId,
          action: action,
          reason: reason || null,
        });

      actionMessage = `Message ${action === 'hide' ? 'hidden' : 'unhidden'} successfully`;
    }

    // Handle user ban/unban
    if (action === 'ban' || action === 'unban') {
      // Check if user to ban is an admin (prevent banning admins)
      const { data: targetUser } = await supabase
        .from('chat_users')
        .select('role')
        .eq('id', userId)
        .single();

      if (targetUser && (targetUser.role === 'admin' || targetUser.role === 'master-admin')) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Cannot ban admin or master-admin users' },
          { status: 403 }
        );
      }

      const isBanned = action === 'ban';
      const { error: banError } = await supabase
        .from('chat_users')
        .update({ is_banned: isBanned })
        .eq('id', userId);

      if (banError) {
        logger.error('Error banning/unbanning user:', banError);
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Failed to update user ban status' },
          { status: 500 }
        );
      }

      // Log the moderation action
      await supabase
        .from('moderation_logs')
        .insert({
          message_id: null,
          admin_id: adminId,
          action: action,
          reason: reason || null,
        });

      actionMessage = `User ${action === 'ban' ? 'banned' : 'unbanned'} successfully`;
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: actionMessage,
    });
  } catch (error) {
    logger.error('Error in POST /api/admin/moderation:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
