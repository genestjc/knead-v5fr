import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse, TownsClaimRequest } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * POST /api/towns/claim
 * Create withdrawal request for contributor's personal earnings
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount } = body;

    if (!userId || !amount) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: userId, amount' },
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
      .select('available_balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    if (wallet.available_balance < amount) {
      return NextResponse.json<ApiResponse<null>>(
        { 
          success: false, 
          error: `Insufficient balance. Available: ${wallet.available_balance}, Requested: ${amount}` 
        },
        { status: 400 }
      );
    }

    // Create claim request (optimistically deduct from available balance)
    const { data: claimRequest, error: claimError } = await supabase
      .from('towns_claim_requests')
      .insert({
        user_id: userId,
        amount: amount,
        status: 'pending',
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

    // Optimistically deduct from available balance
    const { error: deductError } = await supabase
      .from('participant_wallets')
      .update({
        available_balance: wallet.available_balance - amount,
      })
      .eq('user_id', userId);

    if (deductError) {
      console.error('Error deducting from balance:', deductError);
      // Rollback claim request
      await supabase
        .from('towns_claim_requests')
        .delete()
        .eq('id', claimRequest.id);

      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to process claim request' },
        { status: 500 }
      );
    }

    // TODO: Later integrate ThirdWeb Engine for auto-processing
    // For now, admin manually processes via dashboard

    return NextResponse.json<ApiResponse<TownsClaimRequest>>({
      success: true,
      data: {
        id: claimRequest.id,
        userId: claimRequest.user_id,
        amount: claimRequest.amount,
        status: claimRequest.status,
        requestedAt: new Date(claimRequest.created_at),
      },
      message: `Claim request created successfully. Amount: ${amount} TOWNS. Status: Pending admin approval.`,
    });
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
