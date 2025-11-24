import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, awardLike as awardLikeHelper, unlikeMessage as unlikeMessageHelper } from '@/lib/supabase/chat-client';
import type { ActionType, EventType, ApiResponse } from '@/types/chat';
import { createThirdwebClient, getContract } from 'thirdweb';
import { getOwnedNFTs } from 'thirdweb/extensions/erc1155';
import { base } from 'thirdweb/chains';

export const dynamic = 'force-dynamic';

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const CONTRIBUTOR_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
const CONTRIBUTOR_TOKEN_IDS = [10n, 11n, 12n];

const client = createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY! });
const contract = getContract({ client, address: CONTRIBUTOR_CONTRACT_ADDRESS!, chain: base });

/**
 * Verifies on-chain if a user is a contributor.
 * @param userAddress The wallet address of the user.
 * @returns Promise<boolean>
 */
async function userIsContributor(userAddress: string): Promise<boolean> {
    if (!userAddress) return false;
    try {
        const nfts = await getOwnedNFTs({ contract, owner: userAddress });
        return nfts.some(nft => CONTRIBUTOR_TOKEN_IDS.includes(nft.id));
    } catch (error) {
        console.error("On-chain contributor check failed:", error);
        return false;
    }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageId, contributorId, actionType, eventType } = body;

    if (!messageId || !contributorId || !actionType || !eventType) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    const supabase = createSupabaseAdmin();
    const { data: contributor, error: contributorError } = await supabase.from('chat_users').select('address').eq('id', contributorId).single();

    if (contributorError || !contributor) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Contributor not found' }, { status: 404 });
    }

    // --- REFACTORED PERMISSION CHECK ---
    const hasPermission = await userIsContributor(contributor.address);
    if (!hasPermission) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Only contributors can award likes.' }, { status: 403 });
    }
    // --- END REFACTOR ---

    // The rest of your existing logic remains the same...
    const { data: message, error: messageError } = await supabase.from('chat_messages').select('user_id').eq('id', messageId).single();
    if (messageError || !message) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Message not found' }, { status: 404 });
    }
    if (message.user_id === contributorId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'You cannot like your own message' }, { status: 400 });
    }
    const { data: existingLike } = await supabase.from('message_likes').select('id').eq('message_id', messageId).eq('contributor_id', contributorId).single();
    if (existingLike) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'You have already liked this message' }, { status: 400 });
    }

    const result = await awardLikeHelper(messageId, contributorId, actionType as ActionType, eventType as EventType);
    if (!result.success) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: result.error || 'Failed to award like' }, { status: 400 });
    }

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: result,
      message: `Successfully awarded points!`,
    });
  } catch (error) {
    console.error('Error in POST /api/chat/like:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// The DELETE function does not require a permission refactor as it already correctly
// checks for the specific `contributorId` who created the like. It can remain as is.
export async function DELETE(req: NextRequest) {
  // ... your existing DELETE logic ...
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

    const likeAge = Date.now() - new Date(like.created_at).getTime();
    const fiveMinutes = 5 * 60 * 1000;

    if (likeAge > fiveMinutes) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Cannot unlike after 5 minutes' },
        { status: 400 }
      );
    }

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
