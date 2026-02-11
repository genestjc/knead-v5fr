import { NextRequest, NextResponse } from 'next/server';
import { awardTownsViaEngine, isParticipant } from '@/lib/blockchain/award-rewards-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminAddress, eventId, participantAddress, bonusAmount, bonusType } = body;

    console.log('📥 Award bonus request:', { adminAddress, eventId, participantAddress, bonusAmount, bonusType });

    // Validate required fields
    if (!participantAddress || !bonusAmount || !bonusType) {
      console.error('❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: participantAddress, bonusAmount, bonusType' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    if (bonusAmount <= 0) {
      console.error('❌ Invalid bonus amount:', bonusAmount);
      return NextResponse.json(
        { error: 'Bonus amount must be positive' },
        { status: 400 }
      );
    }

    // Check if participant is registered
    console.log('🔍 Checking if participant is registered...');
    const registered = await isParticipant(participantAddress);
    console.log('✅ Participant registered:', registered);
    
    if (!registered) {
      console.error('❌ Participant not registered:', participantAddress);
      return NextResponse.json(
        { 
          error: 'Participant not registered',
          details: `${participantAddress} must be registered before receiving bonuses. Register them first via the contract's registerParticipant() function.`,
        },
        { status: 400 }
      );
    }

    console.log('🎁 Awarding bonus via Engine...');

    // Award tokens via Engine
    const result = await awardTownsViaEngine(
      participantAddress,
      bonusAmount,
      bonusType,
      eventId
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
    console.error('Error stack:', error.stack);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to award bonus',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
