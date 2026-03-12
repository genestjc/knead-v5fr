import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const adminAddress = searchParams.get('adminAddress');

    console.log('🔍 Mailing list request:', { type, adminAddress });

    // ... admin validation ...

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
