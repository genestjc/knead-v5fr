import { NextRequest, NextResponse } from 'next/server';
import { awardTownsViaEngine } from '@/lib/blockchain/award-rewards-engine';
import prisma from '@/lib/prisma';

/**
 * Award Event Bonus via Admin Context Menu
 * Allows admins to award bonus tokens during live events
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminAddress, eventId, participantAddress, bonusAmount, bonusType } = body;

    // Validate required fields
    if (!adminAddress || !participantAddress || !bonusAmount || !bonusType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ✅ Verify admin status
    const admin = await prisma.user.findUnique({
      where: { walletAddress: adminAddress.toLowerCase() },
    });

    if (!admin || admin.role !== 'CONTRIBUTOR') {
      return NextResponse.json(
        { error: 'Unauthorized: Only contributors can award bonuses' },
        { status: 403 }
      );
    }

    console.log('🎁 Admin awarding bonus:', {
      admin: adminAddress,
      participant: participantAddress,
      amount: bonusAmount,
      type: bonusType,
      eventId: eventId || 'general',
    });

    // ✅ Award tokens via Engine (with eventId if provided)
    const result = await awardTownsViaEngine(
      participantAddress,
      bonusAmount,
      bonusType,
      eventId // Pass eventId for event bonuses
    );

    console.log('✅ Bonus awarded successfully:', result.transactionHash);

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      amount: bonusAmount,
      bonusType,
      message: `Awarded ${bonusAmount} TOWNS to ${participantAddress}`,
    });
  } catch (error: any) {
    console.error('❌ Error awarding bonus:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to award bonus',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
