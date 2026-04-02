import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

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
      .eq('is_active', true)
      .order('subscribed_at', { ascending: false });

    console.log('📥 Supabase response:', {
      subscribersCount: subscribers?.length,
      error: error,
      firstRow: subscribers?.[0],
      rawData: subscribers
    });

    if (error) {
      console.error('❌ Supabase query error:', error);
      throw error;
    }

    console.log('📧 API returning subscribers:', subscribers?.length || 0, 'rows');
    console.log('📧 Data:', JSON.stringify(subscribers, null, 2));

    return NextResponse.json(
      { success: true, data: subscribers || [] },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (err: any) {
    console.error('❌ List subscribers error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
