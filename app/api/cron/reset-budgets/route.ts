import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Defensive check: Ensure environment variables are loaded.
  // This helps prevent build failures if the variables are missing during Vercel's analysis.
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('CRON Error: Missing Supabase environment variables.');
    return NextResponse.json(
      { message: 'Internal Server Error: Missing Supabase configuration.' },
      { status: 500 }
    );
  }

  try {
    // Initialize the client only after confirming variables exist.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('CRON: Starting budget reset...');
    const { error } = await supabase.rpc('reset_monthly_budgets');

    if (error) {
      console.error('CRON: Error calling reset_monthly_budgets RPC:', error.message);
      return NextResponse.json({ message: 'Error resetting budgets', error: error.message }, { status: 500 });
    }

    console.log('CRON: Budget reset successful.');
    return NextResponse.json({ message: 'Budgets reset successfully' });

  } catch (e: any) {
    console.error('CRON: An unexpected error occurred during execution:', e);
    return NextResponse.json({ message: 'An unexpected error occurred', error: e.message }, { status: 500 });
  }
}
