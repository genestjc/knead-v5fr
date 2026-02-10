import { NextRequest, NextResponse } from 'next/server';
import { isContributor } from '@/lib/blockchain/contributor-nft';
import { awardTownsViaEngine } from '@/lib/blockchain/award-rewards-engine';
import { getUserTownsBalance } from '@/lib/blockchain/towns-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/award-tokens
 * 
 * Award tokens via Engine wallet (no user signature required).
 * 
 * This endpoint:
 * 1. Verifies contributor has NFT permission
 * 2. Awards tokens via Engine wallet
 * 3. Returns transaction hash
 */
export async function POST(req: NextRequest) {
  try {
    const { contributorAddress, participantAddress, amount, actionType } = await req.json();

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
    const contributorCheck = await isContributor(contributorAddress);
    if (!contributorCheck.isContributor) {
      return NextResponse.json({ 
        error: 'Only contributors with NFT permission can award tokens.' 
      }, { status: 403 });
    }

    // 2. Award tokens via Engine wallet (no user signature required)
    const result = await awardTownsViaEngine(
      participantAddress,
      amountNum,
      actionType || 'message_like'
    );

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      amount: amountNum,
      message: 'Tokens awarded successfully! 25% contributed to the weekly pool for all contributors.',
    });

  } catch (error: any) {
    console.error('Token award error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to award tokens.' 
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
    const contributorCheck = await isContributor(contributorAddress);
    
    if (!contributorCheck.isContributor) {
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
