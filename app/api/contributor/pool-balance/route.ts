import { NextRequest, NextResponse } from 'next/server';
import { getContributorPoolBalance } from '@/lib/blockchain/award-rewards-engine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contributor/pool-balance
 * 
 * Get the current contributor pool balance.
 * This is the 25% of earnings accumulated by the Engine wallet
 * that will be distributed weekly to all contributors.
 */
export async function GET(req: NextRequest) {
  try {
    const poolBalance = await getContributorPoolBalance();

    return NextResponse.json({
      success: true,
      balance: poolBalance,
      balanceFormatted: `${poolBalance.toFixed(2)} $TOWNS`,
    });

  } catch (error: any) {
    console.error('Error fetching contributor pool balance:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch pool balance.' 
    }, { status: 500 });
  }
}
