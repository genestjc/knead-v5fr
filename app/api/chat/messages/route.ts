import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { moderateContent, shouldAutoReject } from '@/lib/chat/moderation';
import { canPostInChannel } from '@/lib/chat/permissions';
import type { ChatMessage, ApiResponse, PaginatedResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/messages
 * Fetch messages for a channel with cursor-based pagination
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const before = searchParams.get('before'); // cursor (timestamp)

  if (!channelId) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Missing channelId parameter' },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdmin();

  try {
    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        channel_id,
        user_id,
        content,
        created_at,
        reply_to_id,
        is_deleted,
        is_hidden,
        moderation_score,
        chat_users!inner (
          id,
          address,
          display_name,
          avatar,
          role,
          membership_tier,
          contributor_type,
          alias
        ),
        reply_to:chat_messages!reply_to_id (
          id,
          content,
          user_id,
          chat_users!inner (
            display_name,
            alias
          )
        )
      `)
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Cursor-based pagination
    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Get likes count for each message
    const messageIds = data.map((msg) => msg.id);
    const { data: likesData } = await supabase
      .from('message_likes')
      .select('message_id')
      .in('message_id', messageIds);

    const likesCounts = likesData?.reduce((acc: Record<string, number>, like) => {
      acc[like.message_id] = (acc[like.message_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Get replies count for each message
    const { data: repliesData } = await supabase
      .from('chat_messages')
      .select('reply_to_id')
      .in('reply_to_id', messageIds)
      .eq('is_deleted', false);

    const repliesCounts = repliesData?.reduce((acc: Record<string, number>, reply) => {
      acc[reply.reply_to_id] = (acc[reply.reply_to_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Format messages
    const messages: ChatMessage[] = data.map((msg) => ({
      id: msg.id,
      channelId: msg.channel_id,
      userId: msg.user_id,
      content: msg.content,
      timestamp: new Date(msg.created_at),
      replyToId: msg.reply_to_id,
      replyToContent: msg.reply_to?.content,
      replyToUser: msg.reply_to?.chat_users?.alias || msg.reply_to?.chat_users?.display_name,
      likesCount: likesCounts[msg.id] || 0,
      repliesCount: repliesCounts[msg.id] || 0,
      isDeleted: msg.is_deleted,
      isHidden: msg.is_hidden,
      moderationScore: msg.moderation_score,
      user: {
        id: msg.chat_users.id,
        address: msg.chat_users.address,
        displayName: msg.chat_users.display_name,
        avatar: msg.chat_users.avatar,
        role: msg.chat_users.role,
        membershipTier: msg.chat_users.membership_tier,
        contributorType: msg.chat_users.contributor_type,
        isBanned: false,
        alias: msg.chat_users.alias,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));

    const response: PaginatedResponse<ChatMessage> = {
      data: messages,
      nextCursor: messages.length === limit ? messages[messages.length - 1].timestamp.toISOString() : undefined,
      hasMore: messages.length === limit,
      total: messages.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/chat/messages:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/messages
 * Create a new message with content moderation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, channelId, content, replyToId } = body;

    if (!userId || !channelId || !content) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (content.trim().length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Message content cannot be empty' },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Message content exceeds maximum length (2000 characters)' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Get user
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check permissions
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

    const canPost = canPostInChannel(chatUser, channelId);
    if (!canPost.canPost) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: canPost.reason || 'You do not have permission to post in this channel' },
        { status: 403 }
      );
    }

    // Moderate content using OpenAI
    const moderationResult = await moderateContent(content);

    // Auto-reject if content is highly inappropriate
    if (shouldAutoReject(moderationResult)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: moderationResult.message || 'Message contains inappropriate content' },
        { status: 400 }
      );
    }

    // Insert message
    const { data: message, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        channel_id: channelId,
        content: content.trim(),
        reply_to_id: replyToId || null,
        moderation_score: moderationResult.score,
        moderation_categories: moderationResult.categories,
      })
      .select()
      .single();

    if (insertError || !message) {
      console.error('Error inserting message:', insertError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to create message' },
        { status: 500 }
      );
    }

    // Check for automatic bonuses
    // Guest response bonus: Admin replies to participant
    if (replyToId && (user.role === 'admin' || user.role === 'master-admin')) {
      const { data: replyToMessage } = await supabase
        .from('chat_messages')
        .select('user_id, chat_users!inner(role)')
        .eq('id', replyToId)
        .single();

      if (replyToMessage?.chat_users?.role === 'viewer') {
        // Award guest response bonus to the participant
        await supabase.rpc('award_automatic_bonus', {
          p_user_id: replyToMessage.user_id,
          p_bonus_type: 'guest_response',
          p_metadata: {
            message_id: message.id,
            admin_id: userId,
          },
        });
      }
    }

    // Thread starter bonus: Check if original message now has 10+ replies
    if (replyToId) {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('reply_to_id', replyToId)
        .eq('is_deleted', false);

      if (count === 10) {
        // Award thread starter bonus to the original poster
        const { data: originalMessage } = await supabase
          .from('chat_messages')
          .select('user_id')
          .eq('id', replyToId)
          .single();

        if (originalMessage) {
          await supabase.rpc('award_automatic_bonus', {
            p_user_id: originalMessage.user_id,
            p_bonus_type: 'thread_starter',
            p_metadata: {
              message_id: replyToId,
              replies_count: count,
            },
          });
        }
      }
    }

    return NextResponse.json<ApiResponse<ChatMessage>>({
      success: true,
      data: {
        id: message.id,
        channelId: message.channel_id,
        userId: message.user_id,
        content: message.content,
        timestamp: new Date(message.created_at),
        replyToId: message.reply_to_id,
        likesCount: 0,
        repliesCount: 0,
        isDeleted: false,
        isHidden: false,
        moderationScore: moderationResult.score,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/chat/messages:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
