import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { TREASURY_CONFIG } from '@/lib/chat/point-values';
import { getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { client } from '@/thirdweb-client';
import { baseSepolia } from 'thirdweb/chains';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/withdraw
 * 
 * Contributor requests withdrawal of their earned $TOWNS
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amountPoints } = body;

    if (!userId || !amountPoints) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or amountPoints' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // 1. Verify user is a contributor
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('id, role, address, personal_earnings_available')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.role !== 'contributor') {
      return NextResponse.json(
        { success: false, error: 'Only contributors can withdraw earnings' },
        { status: 403 }
      );
    }

    // 2. Verify user has sufficient balance
    if (user.personal_earnings_available < amountPoints) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Insufficient balance. Available: ${user.personal_earnings_available} points` 
        },
        { status: 400 }
      );
    }

    // 3. Convert points to $TOWNS
    const amountTowns = amountPoints / TREASURY_CONFIG.POINTS_PER_TOWNS;

    if (amountTowns < 1) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Minimum withdrawal is ${TREASURY_CONFIG.POINTS_PER_TOWNS} points (1 $TOWNS)` 
        },
        { status: 400 }
      );
    }

    // 4. Check treasury balance (placeholder - implement actual check)
    // TODO: Query $TOWNS token balance of treasury wallet
    const treasuryBalance = 300; // Replace with actual balance check

    if (treasuryBalance < amountTowns) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient treasury balance. Please contact admin.' 
        },
        { status: 500 }
      );
    }

    if (treasuryBalance < TREASURY_CONFIG.CRITICAL_BALANCE) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Treasury balance critically low. Withdrawals temporarily paused.' 
        },
        { status: 503 }
      );
    }

    // 5. Execute withdrawal transaction
    try {
      // Initialize server wallet
      if (!process.env.THIRDWEB_PRIVATE_KEY) {
        throw new Error('THIRDWEB_PRIVATE_KEY not configured');
      }

      const account = privateKeyToAccount({
        client,
        privateKey: process.env.THIRDWEB_PRIVATE_KEY,
      });

      // Get $TOWNS token contract
      const townsContract = getContract({
        client,
        chain: baseSepolia,
        address: process.env.TOWNS_TOKEN_ADDRESS || '0x...', // Add your $TOWNS token address
      });

      // Prepare transfer transaction
      const transaction = prepareContractCall({
        contract: townsContract,
        method: 'function transfer(address to, uint256 amount) returns (bool)',
        params: [user.address, BigInt(Math.floor(amountTowns * 1e18))], // Convert to wei
      });

      // Send transaction
      const { transactionHash } = await sendTransaction({
        transaction,
        account,
      });

      // 6. Update database
      const { error: updateError } = await supabase
        .from('chat_users')
        .update({
          personal_earnings_available: user.personal_earnings_available - amountPoints,
          personal_earnings_withdrawn: (user.personal_earnings_withdrawn || 0) + amountPoints,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update user balance:', updateError);
        // Transaction succeeded but DB update failed - manual reconciliation needed
        return NextResponse.json(
          { 
            success: true,
            warning: 'Transaction succeeded but balance update failed. Please contact admin.',
            transactionHash,
            amountTowns,
          },
          { status: 200 }
        );
      }

      // 7. Log withdrawal
      await supabase.from('withdrawal_logs').insert({
        user_id: userId,
        amount_points: amountPoints,
        amount_towns: amountTowns,
        recipient_address: user.address,
        transaction_hash: transactionHash,
        status: 'completed',
        created_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        transactionHash,
        amountTowns,
        amountPoints,
        newBalance: user.personal_earnings_available - amountPoints,
        message: `Successfully withdrew ${amountTowns} $TOWNS to ${user.address}`,
      });

    } catch (txError) {
      console.error('Transaction error:', txError);
      
      // Log failed withdrawal attempt
      await supabase.from('withdrawal_logs').insert({
        user_id: userId,
        amount_points: amountPoints,
        amount_towns: amountTowns,
        recipient_address: user.address,
        status: 'failed',
        error_message: txError instanceof Error ? txError.message : 'Unknown error',
        created_at: new Date().toISOString(),
      });

      return NextResponse.json(
        { 
          success: false, 
          error: `Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}` 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Withdrawal error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/withdraw
 * 
 * Get user's withdrawal history
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    const { data: withdrawals, error } = await supabase
      .from('withdrawal_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      withdrawals: withdrawals || [],
    });

  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch withdrawal history' },
      { status: 500 }
    );
  }
}
