import { NextRequest, NextResponse } from 'next/server';
import { isContributor } from '@/lib/blockchain/contributor-nft';
import { awardTownsViaEngine } from '@/lib/blockchain/award-rewards-engine';
import { getUserTownsBalance } from '@/lib/blockchain/towns-utils';
import { isParticipantRegistered, registerParticipant } from '@/lib/blockchain/register-participant';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/award-tokens
 * 
 * Award tokens via Engine wallet (no user signature required).
 * 
 * This endpoint:
 * 1. Verifies contributor has NFT permission
 * 2. Auto-registers participant if needed
 * 3. Awards tokens via Engine wallet (80/20 split)
 * 4. Returns transaction hash
 */
export async function POST(req: NextRequest) {
  try {
    const { contributorAddress, participantAddress, amount, actionType, messageId } = await req.json();

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

    // 2. Check if participant is registered
    const isRegistered = await isParticipantRegistered(participantAddress);
    
    // If not registered, register them first (auto-registration on first tip)
    if (!isRegistered) {
      console.log('🔄 Participant not registered, auto-registering:', participantAddress);
      
      try {
        await registerParticipant(participantAddress);
        console.log('✅ Participant registered successfully');
      } catch (regError) {
        console.error('Failed to register participant:', regError);
        return NextResponse.json(
          { error: 'Failed to register participant before awarding tokens' },
          { status: 500 }
        );
      }
    }

    // 3. Award tokens via Engine wallet (80/20 split)
    // messageId is the Towns Protocol message ID (eventId in Towns SDK)
    const result = await awardTownsViaEngine(
      contributorAddress,
      participantAddress,
      amountNum,
      messageId || 'no-message-id',
      actionType || 'message_like'
    );

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      amount: amountNum,
      contributorCashback: amountNum * 0.2, // 20% cashback
      participantReceived: amountNum * 0.8, // 80% to participant
      messageId: messageId || null,
      wasAutoRegistered: !isRegistered,
      message: 'Tokens awarded successfully! Contributor receives 20% cashback.',
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
