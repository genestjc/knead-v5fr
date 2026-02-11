import { NextRequest, NextResponse } from 'next/server';
import { markEventAttendance } from '@/lib/blockchain/event-management';
import { awardTownsViaEngine } from '@/lib/blockchain/award-rewards-engine';
import { hasKneadMonthlyNFT } from '@/lib/blockchain/check-nft-ownership';

export const dynamic = 'force-dynamic';

/**
 * POST /api/events/mark-attendance
 * 
 * Mark attendance when a user joins a Daily call.
 * 
 * This endpoint:
 * 1. Verifies user has Knead Monthly NFT
 * 2. Marks attendance on-chain (if contract supports it)
 * 3. Awards attendance bonus via awardEventBonus
 */
export async function POST(req: NextRequest) {
  try {
    const { eventId, participantAddress, attendanceBonus } = await req.json();

    // Validate inputs
    if (!eventId || !participantAddress) {
      return NextResponse.json({ 
        error: 'Missing required fields: eventId and participantAddress are required.' 
      }, { status: 400 });
    }

    const eventIdNum = parseInt(eventId);
    if (isNaN(eventIdNum)) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 });
    }

    // 1. Verify user has Knead Monthly NFT
    const hasNFT = await hasKneadMonthlyNFT(participantAddress);
    if (!hasNFT) {
      return NextResponse.json({ 
        error: 'Only Knead Monthly NFT holders can receive attendance bonuses.' 
      }, { status: 403 });
    }

    let transactionHash = '';
    let message = '';

    try {
      // 2. Try to mark attendance on-chain
      const result = await markEventAttendance(eventIdNum, participantAddress);
      transactionHash = result.transactionHash;
      message = 'Attendance marked successfully on-chain!';
      
      console.log('✅ Attendance marked on-chain:', {
        eventId: eventIdNum,
        participant: participantAddress,
        txHash: transactionHash,
      });
    } catch (attendanceError: any) {
      console.warn('⚠️ Could not mark attendance on-chain:', attendanceError.message);
      
      // 3. Fallback: Award attendance bonus directly
      const bonusAmount = attendanceBonus || 50; // Default 50 TOWNS for attendance
      
      try {
        const bonusResult = await awardTownsViaEngine(
          participantAddress,
          bonusAmount,
          'event_attendance',
          eventIdNum
        );
        
        transactionHash = bonusResult.transactionHash;
        message = `Attendance bonus of ${bonusAmount} $TOWNS awarded!`;
        
        console.log('✅ Attendance bonus awarded:', {
          eventId: eventIdNum,
          participant: participantAddress,
          amount: bonusAmount,
          txHash: transactionHash,
        });
      } catch (bonusError: any) {
        console.error('❌ Failed to award attendance bonus:', bonusError);
        throw new Error(`Failed to award attendance bonus: ${bonusError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      transactionHash,
      eventId: eventIdNum,
      participant: participantAddress,
      message,
    });

  } catch (error: any) {
    console.error('Attendance marking error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to mark attendance.' 
    }, { status: 500 });
  }
}
