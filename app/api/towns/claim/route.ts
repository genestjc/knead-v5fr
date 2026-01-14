import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { sendTownsTokens, getTreasuryBalance } from '@/lib/thirdweb/treasury';
import { logger } from '@/lib/logger';
import type { Address } from 'thirdweb';

/**
 * POST /api/towns/claim
 * 
 * Process automated withdrawal of $TOWNS tokens
 * - Validates user has sufficient earnings
 * - Checks Treasury has sufficient balance
 * - Sends tokens immediately via ThirdWeb
 * - Updates user earnings and claim status
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    const { userId, amount, recipientAddress } = await req.json();

    // Validate input
    if (!userId || !amount || !recipientAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, amount, recipientAddress' },
        { status: 400 }
      );
    }

    const claimAmount = parseFloat(amount);
    if (isNaN(claimAmount) || claimAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Get user and check permissions
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('role, personal_earnings_available')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.role !== 'contributor' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only contributors can claim earnings' },
        { status: 403 }
      );
    }

    // Check user has sufficient earnings
    const availableEarnings = parseFloat(user.personal_earnings_available || '0');
    if (claimAmount > availableEarnings) {
      return NextResponse.json(
        { 
          error: 'Insufficient earnings',
          available: availableEarnings,
          requested: claimAmount
        },
        { status: 400 }
      );
    }

    // Check Treasury has sufficient balance
    const treasuryBalanceStr = await getTreasuryBalance();
    const treasuryBalance = parseFloat(treasuryBalanceStr);
    
    if (claimAmount > treasuryBalance) {
      return NextResponse.json(
        { 
          error: 'Treasury has insufficient funds. Please contact admin.',
          treasuryBalance,
          requested: claimAmount
        },
        { status: 503 }
      );
    }

    // Create claim record with 'processing' status
    const { data: claim, error: claimError } = await supabase
      .from('towns_claim_requests')
      .insert({
        user_id: userId,
        amount: claimAmount.toString(),
        recipient_address: recipientAddress,
        status: 'processing',
      })
      .select()
      .single();

    if (claimError || !claim) {
      throw new Error('Failed to create claim record');
    }

    try {
      // Send tokens via ThirdWeb Treasury
      const { transactionHash, blockNumber } = await sendTownsTokens(
        recipientAddress as Address,
        claimAmount.toString()
      );

      // Update claim to completed
      await supabase
        .from('towns_claim_requests')
        .update({
          status: 'completed',
          transaction_hash: transactionHash,
          block_number: blockNumber?.toString() || null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', claim.id);

      // Deduct from user's available earnings
      const newBalance = availableEarnings - claimAmount;
      await supabase
        .from('chat_users')
        .update({
          personal_earnings_available: newBalance.toString(),
          personal_earnings_withdrawn: (
            parseFloat(user.personal_earnings_available || '0') + claimAmount
          ).toString(),
        })
        .eq('id', userId);

      return NextResponse.json({
        success: true,
        data: {
          id: claim.id,
          transactionHash,
          blockNumber: blockNumber?.toString() || null,
          amount: claimAmount,
          recipient: recipientAddress,
          status: 'completed',
        },
        message: `Successfully sent ${claimAmount} $TOWNS to ${recipientAddress}`,
      });

    } catch (txError) {
      // Transaction failed - update claim status
      await supabase
        .from('towns_claim_requests')
        .update({
          status: 'failed',
          retry_count: 1,
        })
        .eq('id', claim.id);

      throw txError;
    }

  } catch (error) {
    logger.error('Claim processing error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process claim'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/towns/claim
 * 
 * Get claim history for a user
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    const { data: claims, error } = await supabase
      .from('towns_claim_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: claims,
    });

  } catch (error) {
    logger.error('Get claims error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get claim history'
      },
      { status: 500 }
    );
  }
}
