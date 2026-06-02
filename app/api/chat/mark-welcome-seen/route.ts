import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

/**
 * POST /api/chat/mark-welcome-seen
 * Persist modal "seen" state to Supabase so it survives browser history clears.
 * Body: { address: string, type: 'welcome' | 'contributor_welcome' }
 */
export async function POST(req: NextRequest) {
  try {
    const { address, type } = await req.json();

    if (!address || !type) {
      return NextResponse.json(
        { success: false, error: 'Missing address or type' },
        { status: 400 },
      );
    }

    if (type !== 'welcome' && type !== 'contributor_welcome' && type !== 'member_welcome') {
      return NextResponse.json(
        { success: false, error: 'Invalid type — must be welcome, contributor_welcome, or member_welcome' },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdmin();
    const column = type === 'welcome' ? 'welcome_seen' : type === 'contributor_welcome' ? 'contributor_welcome_seen' : 'member_welcome_seen';

    // Upsert so we create the row if the user doesn't exist yet
    const { error } = await supabase
      .from('chat_users')
      .upsert(
        {
          address: address.toLowerCase(),
          [column]: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'address' },
      );

    if (error) {
      console.error('❌ mark-welcome-seen error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ mark-welcome-seen unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
