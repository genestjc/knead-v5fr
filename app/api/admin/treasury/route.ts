import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTreasuryAddress, getTreasuryBalance } from '@/lib/thirdweb/treasury';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/treasury
 * 
 * Returns Treasury wallet status for admin monitoring
 * - Treasury address
 * - Current balance
 * - Pending claims
 * - Total earnings owed to contributors
 * - Health status
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json(
        { error: 'adminId required' },
        { status: 400 }
      );
    }

    // Verify user is admin
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('role')
      .eq('id', adminId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.role !== 'admin' && user.role !== 'emergency_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get Treasury info
    const treasuryAddress = getTreasuryAddress();
    const balanceStr = await getTreasuryBalance();
    const balance = parseFloat(balanceStr);

    // Get pending claims
    const { data: pendingClaims } = await supabase
      .from('towns_claim_requests')
      .select('amount')
      .in('status', ['pending', 'processing']);

    const pendingAmount = pendingClaims?.reduce(
      (sum, claim) => sum + parseFloat(claim.amount),
      0
    ) || 0;

    // Get total earnings owed to contributors
    const { data: contributors } = await supabase
      .from('chat_users')
      .select('personal_earnings_available')
      .eq('role', 'contributor');

    const totalOwed = contributors?.reduce(
      (sum, user) => sum + (parseFloat(user.personal_earnings_available) || 0),
      0
    ) || 0;

    // Check health
    const isHealthy = balance >= totalOwed;
    const warning = !isHealthy
      ? `⚠️ Treasury balance (${balance.toFixed(2)} $TOWNS) is less than owed earnings (${totalOwed.toFixed(2)} $TOWNS). Please fund the Treasury!`
      : null;

    return NextResponse.json({
      success: true,
      data: {
        treasuryAddress,
        balance,
        pendingClaims: pendingAmount,
        totalEarningsOwed: totalOwed,
        isHealthy,
        warning,
      },
    });
  } catch (error) {
    console.error('Treasury status error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get Treasury status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
