import { NextRequest, NextResponse } from 'next/server';
import {
  adminAwardBonus,
  isParticipant,
} from '@/lib/blockchain/award-rewards-engine';

export async function POST(req: NextRequest) {
  try {
    const { adminAddress, participantAddress, bonusAmount, bonusType } =
      await req.json();

    // Validate required fields
    if (!participantAddress || !bonusAmount || !bonusType) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: participantAddress, bonusAmount, bonusType',
        },
        { status: 400 },
      );
    }

    if (bonusAmount <= 0) {
      return NextResponse.json(
        { error: 'Bonus amount must be positive' },
        { status: 400 },
      );
    }

    // Check if participant is registered
    const registered = await isParticipant(participantAddress);
    if (!registered) {
      return NextResponse.json(
        {
          error: 'Participant not registered',
          details: `${participantAddress} must be registered before receiving bonuses.`,
        },
        { status: 400 },
      );
    }

    // Award admin bonus via Engine (100% to participant, bypasses allowances)
    const result = await adminAwardBonus(
      participantAddress,
      bonusAmount,
      bonusType,
    );

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      amount: bonusAmount,
      bonusType,
      message: `Awarded ${bonusAmount} TOWNS to ${participantAddress}`,
    });
  } catch (error: any) {
    console.error('Award bonus failed:', error.message);
    return NextResponse.json(
      {
        error: error.message || 'Failed to award bonus',
        details: error.toString(),
      },
      { status: 500 },
    );
  }
}
