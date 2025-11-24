import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { moderateContent, shouldAutoReject } from '@/lib/chat/moderation';
import type { ChatMessage, ApiResponse, PaginatedResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * A helper function to check the remaining freemium time for a user.
 * This encapsulates the logic previously in `permissions.ts`.
 * @param supabase - The Supabase admin client.
 * @param userId - The ID of the user to check.
 * @returns { success: boolean, reason: string }
 */
async function verifyFreemiumAccess(supabase: any, userId: string): Promise<{ canView: boolean; reason: string }> {
  try {
    const { data, error } = await supabase.rpc('get_freemium_time_left', { p_user_id: userId });
    
    if (error) {
      console.error("Error calling get_freemium_time_left RPC:", error);
      return { canView: false, reason: "Could not verify your access time." };
    }
    
    const minutesLeft = data as number;

    if (minutesLeft <= 0) {
      return { canView: false, reason: "Your 60-minute free viewing period has ended. Please subscribe for full access." };
    }
    
    // If they have time left, log this access to start or continue the session timer.
    await supabase.from('freemium_usage_logs').insert({ user_id: userId });
    
    return { canView: true, reason: "" };

  } catch (rpcError) {
    console.error("Exception during freemium check:", rpcError);
    return { canView: false, reason: "An error occurred while checking your session time." };
  }
}

/**
 * GET /api/chat/messages
 * Fetches messages with robust permissions, including freemium time tracking.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const before = searchParams.get('before');
  const userId = searchParams.get('userId');

  if (!channelId || !userId) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing channelId or userId' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  
  const { data: user, error: userError } = await supabase.from('chat_users').select('id, membership_tier, role').eq('id', userId).single();
  if (userError || !user) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User not found.' }, { status: 404 });
  }

  // --- RESTORED & REFACTORED FREEMIUM LOGIC ---
  if (user.membership_tier === 'freemium') {
    const permission = await verifyFreemiumAccess(supabase, userId);
    if (!permission.canView) {
      return NextResponse.json({ data: [], nextCursor: undefined, hasMore: false, error: permission.reason }, { status: 403 });
    }
  } else if (user.membership_tier !== 'premium' && user.role === 'viewer') {
    // If they are not freemium and not premium/contributor, deny access.
    return NextResponse.json({ data: [], error: 'You do not have permission to view this chat.' }, { status: 403 });
  }
  // --- END LOGIC ---

  // The rest of your fetching logic remains the same.
  try {
    let query = supabase.from('chat_messages')
      .select(`id, channel_id, user_id, content, created_at, reply_to_id, attachment_url, attachment_type, author:chat_users!user_id (id, address, display_name, avatar, role, alias)`)
      .eq('channel_id', channelId).eq('is_deleted', false).eq('is_hidden', false)
      .order('created_at', { ascending: false }).limit(limit);
    if (before) { query = query.lt('created_at', before); }
    const { data, error } = await query;
    if (error) throw error;
    
    // Hydrate with likes/replies (this is correct)
    const messageIds = data.map((msg) => msg.id);
    const [likesData, repliesData] = await Promise.all([
        supabase.from('message_likes').select('message_id').in('message_id', messageIds),
        supabase.from('chat_messages').select('reply_to_id').in('reply_to_id', messageIds).eq('is_deleted', false)
    ]);
    const likesCounts = likesData.data?.reduce((acc: Record<string, number>, like) => { acc[like.message_id] = (acc[like.message_id] || 0) + 1; return acc; }, {}) || {};
    const repliesCounts = repliesData.data?.reduce((acc: Record<string, number>, reply) => { if (reply.reply_to_id) { acc[reply.reply_to_id] = (acc[reply.reply_to_id] || 0) + 1; } return acc; }, {}) || {};

    const messages: ChatMessage[] = data.map((msg) => ({
      id: msg.id, channelId: msg.channel_id, userId: msg.user_id, content: msg.content, timestamp: new Date(msg.created_at),
      replyToId: msg.reply_to_id, likesCount: likesCounts[msg.id] || 0, repliesCount: repliesCounts[msg.id] || 0,
      attachmentUrl: msg.attachment_url, attachmentType: msg.attachment_type,
      user: {
          id: msg.author.id, address: msg.author.address, displayName: msg.author.alias || msg.author.display_name,
          avatar: msg.author.avatar, role: msg.author.role
      } as any,
    }));
    return NextResponse.json({ data: messages, nextCursor: messages.length === limit ? messages[messages.length - 1].timestamp.toISOString() : undefined, hasMore: messages.length === limit });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// The POST function remains the same, as freemium users can't post anyway.
export async function POST(req: NextRequest) {
  // ... your existing POST logic is fine ...
  try {
    const { userId, channelId, content, replyToId, attachmentUrl, attachmentType } = await req.json();
    if (!userId || !channelId || (!content?.trim() && !attachmentUrl)) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing required fields.' }, { status: 400 });
    }
    const supabase = createSupabaseAdmin();
    const { data: user, error: userError } = await supabase.from('chat_users').select('id, role').eq('id', userId).single();
    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User not found or not permitted to post.' }, { status: 403 });
    }
    let moderationResult = { score: 0, categories: {} };
    if (content?.trim()) {
        moderationResult = await moderateContent(content);
        if (shouldAutoReject(moderationResult)) {
            return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Message contains inappropriate content' }, { status: 400 });
        }
    }
    const { data: message, error: insertError } = await supabase.from('chat_messages').insert({
        user_id: userId, channel_id: channelId, content: content?.trim() || null, reply_to_id: replyToId || null,
        moderation_score: moderationResult.score, moderation_categories: moderationResult.categories,
        attachment_url: attachmentUrl, attachment_type: attachmentType,
    }).select().single();
    if (insertError) throw insertError;
    return NextResponse.json<ApiResponse<any>>({ success: true, data: message });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
