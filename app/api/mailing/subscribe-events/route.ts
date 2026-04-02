import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, source } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    const { error } = await supabase
      .from('email_subscriptions_events')
      .upsert(
        {
          email: email.trim().toLowerCase(),
          is_active: true,
          source: source || 'welcome_modal',
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: null,
        },
        { onConflict: 'email' }
      );

    if (error) {
      console.error('Supabase error subscribing to events list:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to subscribe. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Subscribe events error:', err);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
