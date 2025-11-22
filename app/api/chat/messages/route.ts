import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { moderateContent, shouldAutoReject } from '@/lib/chat/moderation';
import { canPostMessage, canViewChat } from '@/lib/chat/permissions'; // Use our new permission functions
import type { ChatUser, ChatMessage, ApiResponse, PaginatedResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/messages
 * Fetches messages with viewing permissions, freemium time tracking, and attachment support.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const before = searchParams.get('before');
  const userId = searchParams.get('userId'); // Required for permission checks

  if (!channelId) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing channelId parameter' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  // --- Permission & Freemium Logic ---
  if (!userId) {
    return NextResponse.json({ data: [], error: 'You must be logged in to view the chat.' }, { status: 401 });
  }

  const { data: user, error: userError } = await supabase.from('chat_users').select('*').eq('id', userId).single();
  if (userError || !user) {
    return NextResponse.json({ data: [], error: 'User not found.' }, { status: 404 });
  }

  // Use the canViewChat function which handles freemium time limits
  const viewPermission = await canViewChat(user as ChatUser);
  if (!viewPermission.canView) {
    return NextResponse.json({ data: [], nextCursor: undefined, hasMore: false, error: viewPermission.reason });
  }
  
  // If the user is freemium and is allowed to view, log this access as a "session"
  if (user.membership_tier === 'freemium') {
    // This insert fires off the logic in your `get_freemium_time_left` function
    await supabase.from('freemium_usage_logs').insert({ user_id: user.id });
  }
  // --- End of Logic ---

  try {
    let query = supabase
      .from('chat_messages')
      .select(`
        id, channel_id, user_id, content, created_at, reply_to_id, is_deleted, is_hidden,
        attachment_url, attachment_type, -- Fetch new attachment fields
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
    if (error) throw error;

    // Fetch likes and replies in parallel
    const messageIds = data.map((msg) => msg.id);
    const [likesData, repliesData] = await Promise.all([
        supabase.from('message_likes').select('message_id').in('message_id', messageIds),
        supabase.from('chat_messages').select('reply_to_id').in('reply_to_id', messageIds).eq('is_deleted', false)
    ]);
    
    const likesCounts = likesData.data?.reduce((acc: Record<string, number>, like) => { acc[like.message_id] = (acc[like.message_id] || 0) + 1; return acc; }, {}) || {};
    const repliesCounts = repliesData.data?.reduce((acc: Record<string, number>, reply) => { if (reply.reply_to_id) { acc[reply.reply_to_id] = (acc[reply.reply_to_id] || 0) + 1; } return acc; }, {}) || {};
    
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
      attachmentUrl: msg.attachment_url, // Add to response
      attachmentType: msg.attachment_type, // Add to response
      user: {
        id: msg.author.id, address: msg.author.address, displayName: msg.author.alias || msg.author.display_name,
        avatar: msg.author.avatar, role: msg.author.role, membershipTier: msg.author.membership_tier,
        contributorType: msg.author.contributor_type, isBanned: false, alias: msg.author.alias,
        createdAt: new Date(), updatedAt: new Date(),
      },
    }));

    const response: PaginatedResponse<ChatMessage> = {
      data: messages,
      nextCursor: messages.length === limit ? messages[messages.length - 1].timestamp.toISOString() : undefined,
      hasMore: messages.length === limit,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error in GET /api/chat/messages:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/chat/messages
 * Creates a message with posting permissions and attachment support.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, channelId, content, replyToId, attachmentUrl, attachmentType } = await req.json();

    if (!userId || !channelId) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing user or channel ID' }, { status: 400 });
    }
    // A message can now be just an attachment with no text content
    if (!content?.trim() && !attachmentUrl) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Message must contain content or an attachment.' }, { status: 400 });
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

    // Upgraded Permission Check
    const permission = await canPostMessage(chatUser);
    if (!permission.canPost) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: permission.reason }, { status: 403 });
    }

    // Only moderate if there is text content
    let moderationResult = { score: 0, categories: {} };
    if (content?.trim()) {
        moderationResult = await moderateContent(content);
        if (shouldAutoReject(moderationResult)) {
            return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Message contains inappropriate content' }, { status: 400 });
        }
    }
    
    const { data: message, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId, channel_id: channelId, content: content?.trim() || null, reply_to_id: replyToId || null,
        moderation_score: moderationResult.score, moderation_categories: moderationResult.categories,
        attachment_url: attachmentUrl, // Save to DB
        attachment_type: attachmentType, // Save to DB
      })
      .select().single();

    if (insertError) throw insertError;

    // (Your existing bonus logic for threads and replies remains unchanged)

    return NextResponse.json<ApiResponse<ChatMessage>>({
      success: true,
      data: {
        id: message.id, channelId: message.channel_id, userId: message.user_id, content: message.content,
        timestamp: new Date(message.created_at), replyToId: message.reply_to_id, likesCount: 0,
        repliesCount: 0, isDeleted: false, isHidden: false, moderationScore: moderationResult.score,
        attachmentUrl: message.attachment_url, attachmentType: message.attachment_type,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/chat/messages:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
