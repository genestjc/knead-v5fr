import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const adminAddress = searchParams.get('adminAddress');

    console.log('🔍 Mailing list request:', { type, adminAddress });

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

    const supabase = createSupabaseAdmin();

    const table =
      type === 'events'
        ? 'email_subscriptions_events'
        : 'email_subscriptions_contributors';

    console.log('📊 Querying table:', table);

    const { data: subscribers, error } = await supabase
      .from(table)
      .select('*')
      // .eq('is_active', true)  // ← TEMPORARILY COMMENTED OUT
      .order('subscribed_at', { ascending: false });

    console.log('📥 Supabase response:', {
      subscribersCount: subscribers?.length,
      error: error,
      firstRow: subscribers?.[0],
      rawData: subscribers
    });

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
