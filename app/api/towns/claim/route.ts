import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse, TownsClaimRequest } from '@/types/chat';
import { getTreasuryBalance, sendTownsTokens } from '@/lib/thirdweb/treasury';

export const dynamic = 'force-dynamic';

/**
 * POST /api/towns/claim
 * Create withdrawal request for contributor's personal earnings
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, recipientAddress } = body;

    if (!userId || !amount || !recipientAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: userId, amount, recipientAddress' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Get user
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Only contributors can claim
    if (user.role !== 'contributor' && user.role !== 'admin' && user.role !== 'master-admin') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only contributors can withdraw earnings' },
        { status: 403 }
      );
    }

    // Check available balance
    const { data: wallet, error: walletError } = await supabase
      .from('participant_wallets')
      .select('personal_earnings_available')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    if (wallet.personal_earnings_available < amount) {
      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: `Insufficient balance. Available: ${wallet.personal_earnings_available}, Requested: ${amount}` 
        },
        { status: 400 }
      );
    }

    // Check Treasury balance
    let treasuryBalance: number;
    try {
      const balanceStr = await getTreasuryBalance();
      treasuryBalance = parseFloat(balanceStr);
    } catch (error) {
      console.error('Error getting Treasury balance:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to check Treasury balance' },
        { status: 500 }
      );
    }

    if (treasuryBalance < amount) {
      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: `Insufficient Treasury funds. Treasury balance: ${treasuryBalance} TOWNS, Requested: ${amount} TOWNS. Please contact admin to fund the Treasury.` 
        },
        { status: 500 }
      );
    }

    // Create claim request with status 'processing'
    const { data: claimRequest, error: claimError } = await supabase
      .from('towns_claim_requests')
      .insert({
        user_id: userId,
        amount: amount,
        status: 'processing',
        recipient_address: recipientAddress,
      })
      .select()
      .single();

    if (claimError || !claimRequest) {
      console.error('Error creating claim request:', claimError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to create claim request' },
        { status: 500 }
      );
    }

    // Immediately process withdrawal via Treasury
    try {
      const { transactionHash, blockNumber } = await sendTownsTokens(
        recipientAddress,
        amount.toString()
      );

      // Update claim request to completed
      const { error: updateError } = await supabase
        .from('towns_claim_requests')
        .update({
          status: 'completed',
          transaction_hash: transactionHash,
          block_number: blockNumber.toString(),
          processed_at: new Date().toISOString(),
        })
        .eq('id', claimRequest.id);

      if (updateError) {
        console.error('Error updating claim request:', updateError);
      }

      // Deduct from user's personal earnings
      const { error: deductError } = await supabase
        .from('participant_wallets')
        .update({
          personal_earnings_available: wallet.personal_earnings_available - amount,
          personal_earnings_withdrawn: supabase.rpc('increment', { amount }),
        })
        .eq('user_id', userId);

      if (deductError) {
        console.error('Error deducting from balance:', deductError);
      }

      return NextResponse.json<ApiResponse<TownsClaimRequest>>({
        success: true,
        data: {
          id: claimRequest.id,
          userId: claimRequest.user_id,
          amount: claimRequest.amount,
          status: 'completed',
          requestedAt: new Date(claimRequest.created_at),
          processedAt: new Date(),
          txHash: transactionHash,
        },
        message: `Withdrawal completed successfully! ${amount} TOWNS sent to ${recipientAddress}. Transaction: ${transactionHash}`,
      });
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      
      // Update claim request to failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      const { error: updateError } = await supabase
        .from('towns_claim_requests')
        .update({
          status: 'failed',
          error_message: errorMessage,
          retry_count: supabase.rpc('increment', { by: 1 }),
        })
        .eq('id', claimRequest.id);

      if (updateError) {
        console.error('Error updating failed claim request:', updateError);
      }

      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: `Withdrawal failed: ${errorMessage}. Claim request ID: ${claimRequest.id}` 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/towns/claim:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/towns/claim
 * Get user's claim history
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Get claim requests
    const { data: claims, error: claimsError } = await supabase
      .from('towns_claim_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (claimsError) {
      console.error('Error fetching claim requests:', claimsError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch claim requests' },
        { status: 500 }
      );
    }

    const claimRequests: TownsClaimRequest[] = claims.map((claim) => ({
      id: claim.id,
      userId: claim.user_id,
      amount: claim.amount,
      status: claim.status,
      requestedAt: new Date(claim.created_at),
      processedAt: claim.processed_at ? new Date(claim.processed_at) : undefined,
      txHash: claim.tx_hash,
      notes: claim.notes,
    }));

    return NextResponse.json<ApiResponse<TownsClaimRequest[]>>({
      success: true,
      data: claimRequests,
    });
  } catch (error) {
    console.error('Error in GET /api/towns/claim:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
