import { NextRequest, NextResponse } from 'next/server';
import {
  awardAdminBonus,
  isParticipant,
} from '@/lib/blockchain/award-rewards-engine';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Admin bonuses are a 100% payout from the Engine wallet — restrict to
    // master-admin / admin (moderators excluded from minting money) and require
    // a wallet signature. Previously this route had NO authorization at all.
    const auth = await verifyAdminRequest(req, {
      allowedRoles: ['master-admin', 'admin'],
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { participantAddress, bonusAmount, bonusType } = await req.json();
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
    // Award admin bonus (100% to participant, bypasses allowances)
    const result = await awardAdminBonus(
      participantAddress,
      bonusAmount,
      bonusType
    );
    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      amount: bonusAmount,
      bonusType,
      message: `Admin awarded $${bonusAmount.toFixed(2)} to ${participantAddress} (100% payout)`,
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
