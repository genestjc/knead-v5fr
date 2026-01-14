import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Verify Vercel Cron Secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    logger.error('CRON_SECRET environment variable not set');
    return NextResponse.json(
      { message: 'Server configuration error' },
      { status: 500 }
    );
  }
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    logger.error('CRON: Unauthorized request attempt');
    return NextResponse.json(
      { message: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const supabase = createSupabaseAdmin();

    logger.info('CRON: Starting budget reset...');
    const { error } = await supabase.rpc('reset_monthly_budgets');

    if (error) {
      logger.error('CRON: Error calling reset_monthly_budgets RPC:', error.message);
      return NextResponse.json({ message: 'Error resetting budgets' }, { status: 500 });
    }

    logger.info('CRON: Budget reset successful.');
    return NextResponse.json({ message: 'Budgets reset successfully' });

  } catch (e: any) {
    logger.error('CRON: An unexpected error occurred during execution:', e);
    return NextResponse.json({ message: 'An unexpected error occurred' }, { status: 500 });
  }
}
