import { NextRequest, NextResponse } from 'next/server';
import { allocateWeeklyAllowances, getAllContributors } from '@/lib/blockchain/allocate-allowances';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/allocate-allowances
 *
 * Allocate weekly allowances to contributors.
 * If contributorAddresses is empty, fetches all on-chain contributors.
 *
 * Body: { contributorAddresses?: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { contributorAddresses } = body as { contributorAddresses?: string[] };

    if (!Array.isArray(contributorAddresses) || contributorAddresses.length === 0) {
      console.log('📋 No addresses provided – fetching all on-chain contributors...');
      contributorAddresses = await getAllContributors();
    }

    if (contributorAddresses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No contributors found to allocate allowances to' },
        { status: 400 }
      );
    }

    console.log(`⚡ Allocating weekly allowances to ${contributorAddresses.length} contributors...`);

    const result = await allocateWeeklyAllowances(contributorAddresses);

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      message: `Weekly allowances allocated to ${result.count} contributor(s).`,
      count: result.count,
    });
  } catch (error: any) {
    console.error('❌ Allocate allowances error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to allocate allowances' },
      { status: 500 }
    );
  }
}
