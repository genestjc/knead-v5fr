import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    const { error } = await supabase
      .from('email_subscriptions_contributors')
      .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
      .eq('email', email.toLowerCase())
      .eq('is_active', true);

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
