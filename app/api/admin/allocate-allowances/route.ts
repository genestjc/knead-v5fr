import { NextRequest, NextResponse } from 'next/server';
import { allocateWeeklyAllowances, getAllContributors } from '@/lib/blockchain/allocate-allowances';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';

export const dynamic = 'force-dynamic';

const WALLET_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

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
    const auth = await verifyAdminRequest(req, { requireMaster: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    let { contributorAddresses } = body as { contributorAddresses?: string[] };

    if (!Array.isArray(contributorAddresses) || contributorAddresses.length === 0) {
      console.log('📋 No addresses provided – fetching all on-chain contributors...');
      contributorAddresses = await getAllContributors();
    } else {
      const hasInvalidAddress = contributorAddresses.some(
        (address) => typeof address !== 'string' || !WALLET_ADDRESS_PATTERN.test(address),
      );
      if (hasInvalidAddress) {
        return NextResponse.json(
          { success: false, error: 'Invalid contributor wallet address' },
          { status: 400 },
        );
      }
      contributorAddresses = [...new Set(contributorAddresses.map((address) => address.toLowerCase()))];
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
  } catch (error) {
    console.error('❌ Allocate allowances error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to allocate allowances' },
      { status: 500 }
    );
  }
}
