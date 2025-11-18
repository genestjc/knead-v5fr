/**
 * Admin Treasury Dashboard API
 * 
 * GET /api/admin/treasury?adminId=uuid
 * 
 * Provides Treasury monitoring data for admin dashboard:
 * - Treasury wallet address and balance
 * - Pending claims amount
 * - Total earnings owed to contributors
 * - Health status (balance vs owed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { getTreasuryAddress, getTreasuryBalance } from '@/lib/thirdweb/treasury';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

interface TreasuryStats {
  treasuryAddress: string;
  balance: number;
  pendingClaims: number;
  totalEarningsOwed: number;
  isHealthy: boolean;
  warning?: string;
}

/**
 * GET /api/admin/treasury
 * Get Treasury monitoring data for admin dashboard
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminId parameter' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify admin permissions
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('role')
      .eq('id', adminId)
      .single();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is admin or emergency_admin
    if (user.role !== 'admin' && user.role !== 'master-admin' && user.role !== 'emergency-admin') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Get Treasury address and balance
    let treasuryAddress: string;
    let balance: number;
    
    try {
      treasuryAddress = getTreasuryAddress();
      const balanceStr = await getTreasuryBalance();
      balance = parseFloat(balanceStr);
    } catch (error) {
      console.error('Error getting Treasury data:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to get Treasury data' },
        { status: 500 }
      );
    }

    // Get pending claims (sum of amounts with status 'pending' or 'processing')
    const { data: pendingClaimsData, error: pendingError } = await supabase
      .from('towns_claim_requests')
      .select('amount')
      .in('status', ['pending', 'processing']);

    if (pendingError) {
      console.error('Error fetching pending claims:', pendingError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch pending claims' },
        { status: 500 }
      );
    }

    const pendingClaims = pendingClaimsData.reduce(
      (sum, claim) => sum + (claim.amount || 0),
      0
    );

    // Get total earnings owed (sum of personal_earnings_available for all contributors)
    const { data: walletsData, error: walletsError } = await supabase
      .from('participant_wallets')
      .select('personal_earnings_available');

    if (walletsError) {
      console.error('Error fetching wallets:', walletsError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch earnings data' },
        { status: 500 }
      );
    }

    const totalEarningsOwed = walletsData.reduce(
      (sum, wallet) => sum + (wallet.personal_earnings_available || 0),
      0
    );

    // Calculate health status
    const isHealthy = balance >= totalEarningsOwed;
    let warning: string | undefined;

    if (!isHealthy) {
      warning = `⚠️ Treasury balance (${balance.toFixed(2)} $TOWNS) is less than owed earnings (${totalEarningsOwed.toFixed(2)} $TOWNS). Please fund the Treasury!`;
    }

    const stats: TreasuryStats = {
      treasuryAddress,
      balance,
      pendingClaims,
      totalEarningsOwed,
      isHealthy,
      warning,
    };

    return NextResponse.json<ApiResponse<TreasuryStats>>({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/treasury:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
