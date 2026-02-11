import { NextRequest, NextResponse } from 'next/server';
import { awardTownsViaEngine } from '@/lib/blockchain/award-rewards-engine';

/**
 * Award Event Bonus via Admin Context Menu
 * Allows admins to award bonus tokens during live events
 * Admin verification happens at blockchain level (Engine wallet has ORACLE_ROLE)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminAddress, eventId, participantAddress, bonusAmount, bonusType } = body;

    // Validate required fields
    if (!participantAddress || !bonusAmount || !bonusType) {
      return NextResponse.json(
        { error: 'Missing required fields: participantAddress, bonusAmount, bonusType' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    if (bonusAmount <= 0) {
      return NextResponse.json(
        { error: 'Bonus amount must be positive' },
        { status: 400 }
      );
    }

    console.log('🎁 Admin awarding bonus:', {
      admin: adminAddress || 'system',
      participant: participantAddress,
      amount: bonusAmount,
      type: bonusType,
      eventId: eventId || 'general',
    });

    // ✅ Award tokens via Engine (blockchain-level authorization)
    // The Engine wallet must have ORACLE_ROLE on the contract
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
