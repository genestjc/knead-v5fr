import { NextRequest, NextResponse } from 'next/server';
import { addContributorToRewards } from '@/lib/blockchain/add-contributor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contributorAddress, contributorType, weeklyBudget } = body;

    if (!contributorAddress || contributorType === undefined || !weeklyBudget) {
      return NextResponse.json(
        { error: 'Missing required fields: contributorAddress, contributorType, weeklyBudget' },
        { status: 400 }
      );
    }

    // Validate contributor type (0=Appointed, 1=Invited, 2=Earned)
    if (![0, 1, 2].includes(contributorType)) {
      return NextResponse.json(
        { error: 'Invalid contributorType. Must be 0, 1, or 2' },
        { status: 400 }
      );
    }

    // Call the server-side function that uses Engine wallet (has ADMIN_ROLE)
    const result = await addContributorToRewards(
      contributorAddress,
      contributorType as 0 | 1 | 2,
      weeklyBudget
    );

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      message: `Contributor added with $${weeklyBudget}/week budget`,
    });
  } catch (error) {
    console.error('Error in add-contributor API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add contributor' },
      { status: 500 }
    );
  }
}
