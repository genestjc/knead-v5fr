import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { moderateContent, shouldAutoReject } from '@/lib/chat/moderation';
// Import our new, smarter permission functions
import { canPostMessage, canViewChat } from '@/lib/chat/permissions';
import type { ChatUser, ChatMessage, ApiResponse, PaginatedResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/messages
 * Fetches messages, now with integrated viewing permissions.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const before = searchParams.get('before'); // cursor (timestamp)
  const userId = searchParams.get('userId'); // The client MUST now send the userId to check permissions

  if (!channelId) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Missing channelId parameter' },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdmin();

  // --- New Permission & Freemium Logic ---
  if (!userId) {
    return NextResponse.json({ data: [], error: 'You must be logged in to view the chat.' }, { status: 401 });
  }

  const { data: user, error: userError } = await supabase.from('chat_users').select('*').eq('id', userId).single();
  if (userError || !user) {
    return NextResponse.json({ data: [], error: 'User not found.' }, { status: 404 });
  }

  const viewPermission = await canViewChat(user as ChatUser);
  if (!viewPermission.canView) {
    // Return an empty array but with a clear reason. The frontend can display this message.
    return NextResponse.json({ data: [], nextCursor: undefined, hasMore: false, error: viewPermission.reason });
  }

  // If the user is freemium and is allowed to view, log this as a "session".
  // This increments the usage count that `checkFreemiumTimeRemaining` uses.
  if (user.membership_tier === 'freemium') {
    await supabase.from('freemium_usage_logs').insert({ user_id: user.id });
  }
  // --- End of New Logic ---

  try {
    let query = supabase
      .from('chat_messages')
      .select(`
        id, channel_id, user_id, content, created_at, reply_to_id, is_deleted, is_hidden, moderation_score, moderation_categories,
        author:chat_users!user_id (id, address, display_name, avatar, role, membership_tier, contributor_type, alias)
      `)
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch messages' }, { status: 500 });
    }

    const messageIds = data.map((msg) => msg.id);
    const [likesData, repliesData] = await Promise.all([
        supabase.from('message_likes').select('message_id').in('message_id', messageIds),
        supabase.from('chat_messages').select('reply_to_id').in('reply_to_id', messageIds).eq('is_deleted', false)
    ]);
    
    const likesCounts = likesData.data?.reduce((acc: Record<string, number>, like) => {
        acc[like.message_id] = (acc[like.message_id] || 0) + 1;
        return acc;
    }, {}) || {};

    const repliesCounts = repliesData.data?.reduce((acc: Record<string, number>, reply) => {
      if (reply.reply_to_id) {
        acc[reply.reply_to_id] = (acc[reply.reply_to_id] || 0) + 1;
      }
      return acc;
    }, {}) || {};
    
    const messages: ChatMessage[] = data.map((msg) => ({
      id: msg.id,
      channelId: msg.channel_id,
      userId: msg.user_id,
      content: msg.content,
      timestamp: new Date(msg.created_at),
      replyToId: msg.reply_to_id,
      likesCount: likesCounts[msg.id] || 0,
      repliesCount: repliesCounts[msg.id] || 0,
      isDeleted: msg.is_deleted,
      isHidden: msg.is_hidden,
      moderationScore: msg.moderation_score,
      user: {
        id: msg.author.id,
        address: msg.author.address,
        displayName: msg.author.alias || msg.author.display_name,
        avatar: msg.author.avatar,
        role: msg.author.role,
        membershipTier: msg.author.membership_tier,
        contributorType: msg.author.contributor_type,
        isBanned: false, // Assuming is_banned check happened earlier
        alias: msg.author.alias,
        createdAt: new Date(), // Placeholder
        updatedAt: new Date(), // Placeholder
      },
    }));

    const response: PaginatedResponse<ChatMessage> = {
      data: messages,
      nextCursor: messages.length === limit ? messages[messages.length - 1].timestamp.toISOString() : undefined,
      hasMore: messages.length === limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/chat/messages:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/chat/messages
 * Creates a new message, now with upgraded posting permissions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, channelId, content, replyToId } = body;

    if (!userId || !channelId || !content) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (content.trim().length === 0) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Message content cannot be empty' }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Message content exceeds maximum length' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: user, error: userError } = await supabase.from('chat_users').select('*').eq('id', userId).single();
    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User not found' }, { status: 404 });
    }

    const chatUser: ChatUser = {
      id: user.id, address: user.address, displayName: user.display_name, avatar: user.avatar, role: user.role,
      membershipTier: user.membership_tier, contributorType: user.contributor_type, isBanned: user.is_banned,
      bio: user.bio, alias: user.alias, createdAt: new Date(user.created_at), updatedAt: new Date(user.updated_at),
    };

    // --- Upgraded Permission Check ---
    const permission = await canPostMessage(chatUser);
    if (!permission.canPost) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: permission.reason },
        { status: 403 }
      );
    }
    // --- End of Upgrade ---

    const moderationResult = await moderateContent(content);
    if (shouldAutoReject(moderationResult)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: moderationResult.message || 'Message contains inappropriate content' }, { status: 400 });
    }

    const { data: message, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId, channel_id: channelId, content: content.trim(), reply_to_id: replyToId || null,
        moderation_score: moderationResult.score, moderation_categories: moderationResult.categories,
      })
      .select().single();

    if (insertError || !message) {
      console.error('Error inserting message:', insertError);
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to create message' }, { status: 500 });
    }

    // Your existing bonus logic can remain unchanged...
    if (replyToId && (user.role === 'admin' || user.role === 'master-admin')) { /* ... */ }
    if (replyToId) { /* ... */ }

    return NextResponse.json<ApiResponse<ChatMessage>>({
      success: true,
      data: {
        id: message.id, channelId: message.channel_id, userId: message.user_id, content: message.content,
        timestamp: new Date(message.created_at), replyToId: message.reply_to_id, likesCount: 0,
        repliesCount: 0, isDeleted: false, isHidden: false, moderationScore: moderationResult.score,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/chat/messages:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
