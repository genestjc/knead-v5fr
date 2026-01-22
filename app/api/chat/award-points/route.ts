import { NextRequest, NextResponse } from 'next/server';
import { awardPointsOnChain } from '@/lib/blockchain/rewards-contract';
import { isContributor } from '@/lib/blockchain/contributor-nft';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/award-points
 * 
 * Award points to a participant on-chain.
 * Only contributors with NFT permission can award points.
 * Server wallet pays gas fees for the transaction.
 */
export async function POST(req: NextRequest) {
  try {
    const { contributorAddress, participantAddress, points, actionType } = await req.json();

    // Validate inputs
    if (!contributorAddress || !participantAddress || !points || !actionType) {
      return NextResponse.json({ 
        error: 'Missing required fields: contributorAddress, participantAddress, points, and actionType are required.' 
      }, { status: 400 });
    }

    const pointsNum = parseInt(points);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      return NextResponse.json({ error: 'Invalid points value' }, { status: 400 });
    }

    // Prevent self-awarding
    if (contributorAddress.toLowerCase() === participantAddress.toLowerCase()) {
      return NextResponse.json({ 
        error: 'You cannot award points to yourself.' 
      }, { status: 403 });
    }

    // Verify contributor has NFT permission
    const hasNFT = await isContributor(contributorAddress);
    if (!hasNFT) {
      return NextResponse.json({ 
        error: 'Only contributors with NFT permission can award points.' 
      }, { status: 403 });
    }

    // Award points on-chain (server wallet pays gas)
    await awardPointsOnChain(participantAddress, pointsNum, actionType);

    return NextResponse.json({
      success: true,
      message: 'Points awarded on-chain',
      points: pointsNum,
      participant: participantAddress,
      actionType,
    });

  } catch (error: any) {
    console.error('Award points error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to award points' 
    }, { status: 500 });
  }
}
