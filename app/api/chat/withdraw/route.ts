import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { TREASURY_CONFIG } from '@/lib/chat/point-values';
// Import the production-ready treasury functions
import { sendTownsTokens } from '@/lib/thirdweb/treasury';
import type { Address } from 'thirdweb';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/withdraw
 * Securely converts off-chain points to on-chain $TOWNS using the treasury module.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, amountPoints, recipientAddress } = await req.json();

    if (!userId || !amountPoints || !recipientAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const amountNum = parseFloat(amountPoints);

    // 1. Get user profile and verify balance
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('id, role, personal_earnings_total')
      .eq('id', userId)
      .single();

    if (userError || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.role !== 'contributor') return NextResponse.json({ error: 'Only contributors can withdraw' }, { status: 403 });
    if (user.personal_earnings_total < amountNum) return NextResponse.json({ error: 'Insufficient balance.' }, { status: 400 });

    // 2. Convert points to $TOWNS tokens (as a string, for the treasury function)
    const amountTowns = (amountNum / (TREASURY_CONFIG.POINTS_PER_TOWNS || 1)).toString();

    // 3. Call the high-level treasury function
    // The complexity of the transaction is now hidden inside sendTownsTokens
    const { transactionHash, transactionId } = await sendTownsTokens(
        recipientAddress as Address,
        amountTowns
    );

    // 4. If the transaction was successful, debit the user's off-chain balance
    const newBalance = user.personal_earnings_total - amountNum;
    const { error: updateError } = await supabase
      .from('chat_users')
      .update({ personal_earnings_total: newBalance })
      .eq('id', userId);

    if (updateError) {
        console.error('CRITICAL: Transaction sent but DB update failed!', { transactionId, transactionHash, userId, amountNum });
        return NextResponse.json({ message: 'Withdrawal is processing, but there was a delay updating your balance.' }, { status: 207 });
    }

    return NextResponse.json({
      success: true,
      message: `Withdrawal of ${parseFloat(amountTowns).toFixed(2)} $TOWNS initiated!`,
      transactionHash: transactionHash,
    });

  } catch (error: any) {
    console.error('Withdrawal API error:', error);
    // The error from sendTownsTokens will be more descriptive
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
