import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, awardLike as awardLikeHelper, unlikeMessage as unlikeMessageHelper } from '@/lib/supabase/chat-client';
import { canAwardLikes } from '@/lib/chat/permissions';
import type { ActionType, EventType, ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/like
 * Award a like to a message
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageId, contributorId, actionType, eventType } = body;

    // Validate required fields
    if (!messageId || !contributorId || !actionType || !eventType) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: messageId, contributorId, actionType, eventType' },
        { status: 400 }
      );
    }

    // Validate action type
    const validActionTypes: ActionType[] = [
      'timely_question',
      'substantive_comment',
      'insightful_response',
      'creative_contribution',
      'helpful_clarification',
      'thoughtful_followup',
    ];
    if (!validActionTypes.includes(actionType)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Invalid action type. Must be one of: ${validActionTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate event type
    const validEventTypes: EventType[] = ['live', 'discussion', 'essay'];
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Get contributor
    const { data: contributor, error: contributorError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('id', contributorId)
      .single();

    if (contributorError || !contributor) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Contributor not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const chatUser = {
      id: contributor.id,
      address: contributor.address,
      displayName: contributor.display_name,
      avatar: contributor.avatar,
      role: contributor.role,
      membershipTier: contributor.membership_tier,
      contributorType: contributor.contributor_type,
      isBanned: contributor.is_banned,
      bio: contributor.bio,
      alias: contributor.alias,
      createdAt: new Date(contributor.created_at),
      updatedAt: new Date(contributor.updated_at),
    };

    const canAward = canAwardLikes(chatUser);
    if (!canAward.canAward) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: canAward.reason || 'You do not have permission to award likes' },
        { status: 403 }
      );
    }

    // Check if message exists
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select('user_id, is_deleted, is_hidden')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    if (message.is_deleted || message.is_hidden) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Cannot like a deleted or hidden message' },
        { status: 400 }
      );
    }

    // Check if contributor is trying to like their own message
    if (message.user_id === contributorId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'You cannot like your own message' },
        { status: 400 }
      );
    }

    // Check for duplicate like
    const { data: existingLike } = await supabase
      .from('message_likes')
      .select('id')
      .eq('message_id', messageId)
      .eq('contributor_id', contributorId)
      .single();

    if (existingLike) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'You have already liked this message' },
        { status: 400 }
      );
    }

    // Award the like using database function
    const result = await awardLikeHelper(messageId, contributorId, actionType, eventType);

    if (!result.success) {
      // Parse specific error messages from database
      const errorMessage = result.error || 'Failed to award like';
      
      if (errorMessage.includes('cooldown')) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Please wait before awarding another like' },
          { status: 429 }
        );
      }
      
      if (errorMessage.includes('budget') || errorMessage.includes('exhausted')) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Your daily distribution budget has been exhausted. It resets at midnight UTC.' },
          { status: 400 }
        );
      }

      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: errorMessage },
        { status: 400 }
      );
    }

    // Check for viral bonus (20+ likes)
    const { count } = await supabase
      .from('message_likes')
      .select('id', { count: 'exact', head: true })
      .eq('message_id', messageId);

    if (count === 20) {
      // Award viral bonus to the message author
      await supabase.rpc('award_automatic_bonus', {
        p_user_id: message.user_id,
        p_bonus_type: 'viral',
        p_metadata: {
          message_id: messageId,
          likes_count: count,
        },
      });
    }

    return NextResponse.json<ApiResponse<{ points: number; budgetRemaining: number }>>({
      success: true,
      data: {
        points: result.points || 0,
        budgetRemaining: result.budgetRemaining || 0,
      },
      message: `Successfully awarded ${result.points} points! Budget remaining: ${result.budgetRemaining}`,
    });
  } catch (error) {
    console.error('Error in POST /api/chat/like:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/like
 * Unlike a message (within 5-minute window)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('messageId');
    const contributorId = searchParams.get('contributorId');

    if (!messageId || !contributorId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required parameters: messageId, contributorId' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Check if like exists
    const { data: like, error: likeError } = await supabase
      .from('message_likes')
      .select('created_at')
      .eq('message_id', messageId)
      .eq('contributor_id', contributorId)
      .single();

    if (likeError || !like) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Like not found' },
        { status: 404 }
      );
    }

    // Check if within 5-minute window
    const likeAge = Date.now() - new Date(like.created_at).getTime();
    const fiveMinutes = 5 * 60 * 1000;

    if (likeAge > fiveMinutes) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Cannot unlike after 5 minutes' },
        { status: 400 }
      );
    }

    // Unlike using database function
    const result = await unlikeMessageHelper(messageId, contributorId);

    if (!result.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: result.error || 'Failed to unlike message' },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Successfully unliked message',
    });
  } catch (error) {
    console.error('Error in DELETE /api/chat/like:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
