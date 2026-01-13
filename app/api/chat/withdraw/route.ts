import { NextRequest, NextResponse } from 'next/server';
import { getUserTownsBalance } from '@/lib/blockchain/towns-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/withdraw
 * Query user's blockchain balance and initiate client-side withdrawal.
 * 
 * Note: Actual token transfer is done client-side by the user signing
 * a transaction with their wallet. This endpoint just validates balance.
 */
export async function POST(req: NextRequest) {
  try {
    const { userAddress, amountTowns } = await req.json();

    if (!userAddress || !amountTowns) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const amountNum = parseFloat(amountTowns);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Query blockchain balance directly
    const balance = await getUserTownsBalance(userAddress);

    if (balance < amountNum) {
      return NextResponse.json({ 
        error: `Insufficient balance. You have ${balance.toFixed(2)} $TOWNS, but tried to withdraw ${amountNum.toFixed(2)} $TOWNS.` 
      }, { status: 400 });
    }

    // Return success - actual withdrawal happens client-side
    return NextResponse.json({
      success: true,
      balance: balance,
      message: 'Balance verified. Please sign the transaction in your wallet to complete withdrawal.',
    });

  } catch (error: any) {
    console.error('Withdrawal API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to verify balance.' 
    }, { status: 500 });
  }
}

/**
 * GET /api/chat/withdraw
 * Get user's current $TOWNS balance from blockchain
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json({ error: 'Missing userAddress parameter' }, { status: 400 });
    }

    // Query blockchain balance
    const balance = await getUserTownsBalance(userAddress);

    return NextResponse.json({
      success: true,
      balance: balance,
      address: userAddress,
    });

  } catch (error: any) {
    console.error('Balance query error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch balance.' 
    }, { status: 500 });
  }
}
