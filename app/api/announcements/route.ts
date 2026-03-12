import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client'; // ← Change this

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const isContributor = searchParams.get('isContributor') === 'true';

  try {
    const supabase = createSupabaseAdmin(); // ← Change this

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
    console.error('Error fetching announcements:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
