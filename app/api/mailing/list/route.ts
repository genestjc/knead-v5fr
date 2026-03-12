import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const adminAddress = searchParams.get('adminAddress');

    // Validate admin
    const masterAdmin = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET || '';
    if (!adminAddress || adminAddress.toLowerCase() !== masterAdmin.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!type || !['events', 'contributors'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "events" or "contributors".' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const table =
      type === 'events'
        ? 'email_subscriptions_events'
        : 'email_subscriptions_contributors';

    const { data: subscribers, error } = await supabase
      .from(table)
      .select('*')
      .eq('is_active', true)
      .order('subscribed_at', { ascending: false });

    if (error) {
      console.error('Error fetching subscribers:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch subscribers' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: subscribers || [] });
  } catch (err) {
    console.error('List subscribers error:', err);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
