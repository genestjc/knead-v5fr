import { NextRequest, NextResponse } from 'next/server';
import { getContractBalance } from '@/lib/blockchain/award-rewards-engine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/treasury/balance
 * 
 * Get the current treasury (rewards contract) balance in $TOWNS tokens.
 */
export async function GET(req: NextRequest) {
  try {
    const balance = await getContractBalance();

    return NextResponse.json({
      success: true,
      balance: balance,
      balanceFormatted: `${balance.toFixed(2)} $TOWNS`,
    });

  } catch (error: any) {
    console.error('Error fetching treasury balance:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Failed to fetch treasury balance.' 
    }, { status: 500 });
  }
}
