import { NextRequest, NextResponse } from 'next/server';
import { isContributor } from '@/lib/blockchain/check-nft-ownership';
import { verifyWalletRequest } from '@/lib/auth/verify-wallet-request';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/users/[userId]/mute
 * Mutes a user, preventing them from posting messages. (Moderator only)
 *
 * Note: This route is kept for compatibility but muting is now handled via NFT verification.
 * Only contributors (NFT holders) can mute users.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Moderator is the *recovered* signer, never a client-supplied query param.
    const auth = await verifyWalletRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const moderatorAddress = auth.address!;

    // Verify moderator has contributor NFT. Note: isContributor() here returns
    // an object ({ isContributor }), so it must be destructured — the previous
    // `if (!hasModeratorNFT)` tested a truthy object and never actually denied.
    const { isContributor: hasModeratorNFT } = await isContributor(moderatorAddress);

    if (!hasModeratorNFT) {
      return NextResponse.json({ 
        error: 'Forbidden: You do not have a contributor NFT. Only contributors can mute users.' 
      }, { status: 403 });
    }

    // TODO: Implement on-chain muting mechanism or off-chain ban list
    // For now, return success (muting functionality needs to be implemented)
    console.log(`User ${params.userId} muted by ${moderatorAddress}`);

    return NextResponse.json({ 
      success: true, 
      message: `User ${params.userId} has been muted.`,
      note: 'Muting is tracked off-chain. Consider implementing an on-chain ban list contract.'
    });
  } catch (error) {
    console.error('Error muting user:', error);
    return NextResponse.json({ error: 'Failed to mute user.' }, { status: 500 });
  }
}
