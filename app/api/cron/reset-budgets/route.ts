import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Ensure this route is not statically built
export const dynamic = 'force-dynamic';

export async function GET() {
  // Explicitly create a new Supabase client for server-side operations
  // using the service role key for elevated privileges.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    console.log('CRON: Starting budget reset...');
    const { error } = await supabase.rpc('reset_monthly_budgets');

    if (error) {
      console.error('CRON: Error calling reset_monthly_budgets RPC:', error);
      // Return a 500 response with the error message
      return NextResponse.json({ message: 'Error resetting budgets', error: error.message }, { status: 500 });
    }

    console.log('CRON: Budget reset successful.');
    return NextResponse.json({ message: 'Budgets reset successfully' });

  } catch (e: any) {
    console.error('CRON: An unexpected error occurred:', e);
    return NextResponse.json({ message: 'An unexpected error occurred', error: e.message }, { status: 500 });
  }
}
