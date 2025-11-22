import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { TREASURY_CONFIG } from '@/lib/chat/point-values';
import { getContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { client, engine } from '@/thirdweb-server'; // Assuming you have a file for engine client
import { prepareTransaction } from 'thirdweb/transaction';

export const dynamic = 'force-dynamic';

const TOWNS_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOWNS_TOKEN_ADDRESS!;
const ENGINE_URL = process.env.THIRDWEB_ENGINE_URL!;
const ENGINE_ACCESS_TOKEN = process.env.THIRDWEB_ENGINE_ACCESS_TOKEN!;
const ENGINE_WALLET_ADDRESS = process.env.THIRDWEB_ENGINE_WALLET_ADDRESS!;

/**
 * POST /api/chat/withdraw
 * Converts a contributor's off-chain points into on-chain $TOWNS tokens
 * and sends them to an external wallet, using thirdweb Engine for security.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, amountPoints, recipientAddress } = await req.json();

    if (!userId || !amountPoints || !recipientAddress) {
      return NextResponse.json({ error: 'Missing userId, amountPoints, or recipientAddress' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const amountNum = parseFloat(amountPoints);

    // 1. Get user and verify balance in a single, atomic read
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('id, role, personal_earnings_total')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.role !== 'contributor') {
      return NextResponse.json({ error: 'Only contributors can withdraw' }, { status: 403 });
    }
    if (user.personal_earnings_total < amountNum) {
      return NextResponse.json({ error: 'Insufficient balance.' }, { status: 400 });
    }

    // 2. Convert points to $TOWNS
    const amountTowns = amountNum / (TREASURY_CONFIG.POINTS_PER_TOWNS || 1); // Default to 1 to prevent division by zero
    if (amountTowns < 1) { // Example minimum
        return NextResponse.json({ error: `Minimum withdrawal is ${TREASURY_CONFIG.POINTS_PER_TOWNS} points.`}, { status: 400 });
    }

    // 3. Prepare the on-chain transaction via thirdweb Engine
    const townsContract = getContract({ client, chain: base, address: TOWNS_TOKEN_ADDRESS });
    const tx = prepareTransaction({
      to: TOWNS_TOKEN_ADDRESS,
      data: townsContract.abi, // Simplified for example, should be proper ABI encode
      // Assuming a transfer function: `function transfer(address to, uint256 amount)`
      params: [recipientAddress, BigInt(Math.floor(amountTowns * 1e18))], // Convert to wei
    });

    // 4. Securely send the transaction using Engine
    const { result, error: engineError } = await engine.erc20.transfer(
        "base", // chain
        TOWNS_TOKEN_ADDRESS, // contract address
        {
            to: recipientAddress,
            amount: amountTowns.toString(), // Engine expects amount as a string
        }
    );

    if (engineError || !result?.queueId) {
      console.error("Engine Tx Error:", engineError);
      // TODO: Log failed withdrawal attempt
      return NextResponse.json({ error: 'On-chain transaction failed.' }, { status: 500 });
    }

    // 5. If transaction is successfully queued, update the user's off-chain balance
    const newBalance = user.personal_earnings_total - amountNum;
    const { error: updateError } = await supabase
      .from('chat_users')
      .update({
        personal_earnings_total: newBalance,
        // Add to a withdrawn total for auditing if you have the column
        // personal_earnings_withdrawn: (user.personal_earnings_withdrawn || 0) + amountNum
      })
      .eq('id', userId);

    if (updateError) {
        console.error('CRITICAL: Transaction sent but DB update failed!', { queueId: result.queueId, userId, amountNum });
        // Return success to the user but log a critical error for manual reconciliation
        return NextResponse.json({ message: 'Withdrawal is processing, but there was a delay updating your balance.' }, { status: 207 });
    }
    
    // TODO: Log the successful withdrawal with the queueId for auditing

    return NextResponse.json({
      success: true,
      message: `Withdrawal of ${amountTowns.toFixed(2)} $TOWNS initiated! It may take a few minutes to appear in your wallet.`,
      queueId: result.queueId,
    });

  } catch (error: any) {
    console.error('Withdrawal API error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
