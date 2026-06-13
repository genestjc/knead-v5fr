import { NextRequest, NextResponse } from 'next/server';
import { updateContributorBudget } from '@/lib/blockchain/allocate-allowances';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/contributors/update-budget
 *
 * Update a contributor's weekly budget on the rewards contract.
 *
 * Body: { contributorAddress: string, newBudget: number }
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req, { requireMaster: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { contributorAddress, newBudget } = await req.json();

    if (!contributorAddress) {
      return NextResponse.json(
        { error: 'Missing required field: contributorAddress' },
        { status: 400 }
      );
    }

    if (newBudget === undefined || newBudget === null || newBudget <= 0) {
      return NextResponse.json(
        { error: 'newBudget must be a positive number' },
        { status: 400 }
      );
    }

    console.log(`💰 Updating budget for ${contributorAddress} to ${newBudget} TOWNS...`);

    const result = await updateContributorBudget(contributorAddress, newBudget);

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      message: `Weekly budget updated to ${newBudget} TOWNS for ${contributorAddress}.`,
    });
  } catch (error: any) {
    console.error('❌ Update budget error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update contributor budget' },
      { status: 500 }
    );
  }
}
