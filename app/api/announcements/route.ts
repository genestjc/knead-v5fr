import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const isContributor = searchParams.get('isContributor') === 'true';

  try {
    const supabase = createSupabaseClient();

    let query = supabase
      .from('chat_announcements')
      .select('*')
      .order('posted_at', { ascending: false });

    // If not a contributor, filter out contributors-only announcements
    if (!isContributor) {
      query = query.eq('contributors_only', false);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
