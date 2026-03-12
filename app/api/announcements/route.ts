import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // ← Add this
export const fetchCache = 'force-no-store'; // ← Add this

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const isContributor = searchParams.get('isContributor') === 'true';

  try {
    const supabase = createSupabaseAdmin();

    let query = supabase
      .from('chat_announcements')
      .select('*')
      .order('posted_at', { ascending: false });

    // If not a contributor, filter out contributors-only announcements
    if (!isContributor) {
      query = query.eq('contributors_only', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Supabase query error:', error);
      throw error;
    }

    console.log('📢 API returning announcements:', data?.length || 0, 'rows');
    console.log('📢 Data:', JSON.stringify(data, null, 2)); // ← Debug

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    console.error('❌ Error fetching announcements:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
