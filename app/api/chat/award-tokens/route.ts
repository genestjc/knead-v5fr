import { NextRequest, NextResponse } from 'next/server';
import { isContributor } from '@/lib/blockchain/contributor-nft';
import { getUserTownsBalance } from '@/lib/blockchain/towns-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/award-tokens
 * 
 * Validate token award request before executing on client side.
 * Actual token transfer is signed and executed by the contributor's wallet.
 * 
 * This endpoint:
 * 1. Verifies contributor has NFT permission
 * 2. Checks contributor has sufficient $TOWNS balance
 * 3. Returns validation result
 */
export async function POST(req: NextRequest) {
  try {
    const { contributorAddress, participantAddress, amount, actionType, eventId } = await req.json();

    // Validate inputs
    if (!contributorAddress || !participantAddress || !amount) {
      return NextResponse.json({ 
        error: 'Missing required fields: contributorAddress, participantAddress, and amount are required.' 
      }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Prevent self-awarding
    if (contributorAddress.toLowerCase() === participantAddress.toLowerCase()) {
      return NextResponse.json({ 
        error: 'You cannot award tokens to yourself.' 
      }, { status: 403 });
    }

    // 1. Verify contributor has NFT permission
    const hasNFT = await isContributor(contributorAddress);
    if (!hasNFT) {
      return NextResponse.json({ 
        error: 'Only contributors with NFT permission can award tokens.' 
      }, { status: 403 });
    }

    // 2. Check contributor has sufficient balance
    const contributorBalance = await getUserTownsBalance(contributorAddress);
    if (contributorBalance < amountNum) {
      return NextResponse.json({ 
        error: `Insufficient $TOWNS balance. You have ${contributorBalance.toFixed(2)} $TOWNS, but tried to award ${amountNum.toFixed(2)} $TOWNS.` 
      }, { status: 400 });
    }

    // Validation successful - return success
    // Actual token transfer happens client-side with wallet signature
    return NextResponse.json({
      success: true,
      validated: true,
      contributorBalance,
      amount: amountNum,
      message: 'Validation successful. Please sign the transaction in your wallet to award tokens.',
    });

  } catch (error: any) {
    console.error('Token award validation error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error.' 
    }, { status: 500 });
  }
}

/**
 * GET /api/chat/award-tokens
 * 
 * Get contributor's current award capacity
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contributorAddress = searchParams.get('contributorAddress');

    if (!contributorAddress) {
      return NextResponse.json({ error: 'Missing contributorAddress parameter' }, { status: 400 });
    }

    // Check NFT permission
    const hasNFT = await isContributor(contributorAddress);
    
    if (!hasNFT) {
      return NextResponse.json({
        success: true,
        isContributor: false,
        balance: 0,
        message: 'User does not have contributor NFT.',
      });
    }

    // Get balance
    const balance = await getUserTownsBalance(contributorAddress);

    return NextResponse.json({
      success: true,
      isContributor: true,
      balance,
      address: contributorAddress,
    });

  } catch (error: any) {
    console.error('Contributor capacity query error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch contributor capacity.' 
    }, { status: 500 });
  }
}
