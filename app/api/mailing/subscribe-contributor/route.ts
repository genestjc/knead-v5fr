import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, userAddress, userId } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    if (!userAddress) {
      return NextResponse.json(
        { success: false, error: 'User address is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    const record: Record<string, unknown> = {
      email: email.trim().toLowerCase(),
      user_address: userAddress,
      is_active: true,
      subscribed_at: new Date().toISOString(),
      unsubscribed_at: null,
    };

    if (userId) {
      record.user_id = userId;
    }

    const { error } = await supabase
      .from('email_subscriptions_contributors')
      .upsert(record, { onConflict: 'email' });

    if (error) {
      console.error('Supabase error subscribing to contributors list:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to subscribe. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Subscribe contributor error:', err);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
