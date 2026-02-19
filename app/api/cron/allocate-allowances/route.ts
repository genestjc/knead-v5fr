import { NextRequest, NextResponse } from 'next/server';
import { allocateWeeklyAllowances, getAllContributors } from '@/lib/blockchain/allocate-allowances';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/allocate-allowances
 *
 * Automated cron endpoint – runs every Sunday at midnight UTC.
 * Protected by CRON_SECRET.
 *
 * Fetches all on-chain contributors and calls batchAllocateWeeklyAllowances.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron endpoint not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Starting automated weekly allowance allocation...');

    const contributorAddresses = await getAllContributors();

    if (contributorAddresses.length === 0) {
      console.warn('⚠️ No contributors found – skipping allocation');
      return NextResponse.json({
        success: true,
        message: 'No contributors found – allocation skipped',
        count: 0,
      });
    }

    const result = await allocateWeeklyAllowances(contributorAddresses);

    console.log(`✅ Cron: weekly allowances allocated to ${result.count} contributors. Tx: ${result.transactionHash}`);

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      message: `Weekly allowances allocated to ${result.count} contributor(s).`,
      count: result.count,
    });
  } catch (error: any) {
    console.error('❌ Cron allocate-allowances error:', error);
    return NextResponse.json(
      { error: error.message || 'Allocation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/allocate-allowances
 *
 * Health check for the cron endpoint.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    status: 'ready',
    message: 'Cron endpoint is configured. Use POST with Bearer token to trigger allocation.',
  });
}
