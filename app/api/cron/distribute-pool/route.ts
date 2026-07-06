import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/distribute-pool
 * 
 * Cron endpoint for weekly contributor pool distribution.
 * Protected by CRON_SECRET to prevent unauthorized access.
 * 
 * Triggers the distribution script to:
 * 1. Fetch all contributor NFT holders
 * 2. Claim Engine's accumulated earnings
 * 3. Calculate weighted distribution
 * 4. Send $USDC to each contributor
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json({ 
        error: 'Cron endpoint not configured' 
      }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Import and run the distribution function
    const { distributeContributorPool } = await import('@/scripts/distribute-contributor-pool');
    
    console.log('🕐 Starting weekly contributor pool distribution...');
    const result = await distributeContributorPool();

    return NextResponse.json({
      success: true,
      message: 'Pool distribution completed',
      result,
    });

  } catch (error: any) {
    console.error('Error in cron distribution:', error);
    return NextResponse.json({ 
      error: error.message || 'Distribution failed' 
    }, { status: 500 });
  }
}

/**
 * GET /api/cron/distribute-pool
 * 
 * Vercel cron invokes GET requests, with the same Authorization header when
 * CRON_SECRET is configured.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
