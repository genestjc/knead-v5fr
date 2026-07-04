import { NextRequest, NextResponse } from 'next/server';
import { getAllContributors } from '@/lib/blockchain/allocate-allowances';
import { getContributorStats } from '@/lib/blockchain/contract-reads';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';

export const dynamic = 'force-dynamic';

const CONTRIBUTOR_TYPE_LABELS: Record<number, string> = {
  0: 'Appointed',
  1: 'Invited',
  2: 'Earned',
};

/**
 * GET /api/admin/contributors/stats
 *
 * Fetch on-chain stats for all contributors.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error ?? 'Unauthorized' },
        { status: auth.status ?? 401 }
      );
    }

    const addresses = await getAllContributors();

    if (addresses.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const statsResults = await Promise.allSettled(
      addresses.map(async (address) => {
        const stats = await getContributorStats(address);
        return {
          address,
          typeLabel: CONTRIBUTOR_TYPE_LABELS[stats.cType] ?? 'Unknown',
          ...stats,
        };
      })
    );

    const data = statsResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value);

    const errors = statsResults.filter((r) => r.status === 'rejected').length;
    if (errors > 0) {
      console.warn(`⚠️ Failed to fetch stats for ${errors} contributor(s)`);
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ Error fetching contributor stats:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch contributor stats' },
      { status: 500 }
    );
  }
}
