import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscriberId, adminAddress } = body;

    // Validate admin
    const masterAdmin = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET || '';
    if (!adminAddress || adminAddress.toLowerCase() !== masterAdmin.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!subscriberId) {
      return NextResponse.json(
        { success: false, error: 'subscriberId is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    const { error } = await supabase
      .from('email_subscriptions_events')
      .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
      .eq('id', subscriberId);

    if (error) {
      console.error('Error unsubscribing:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to unsubscribe' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
