import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminAddress, title, content, contributorsOnly } = body;

    if (!adminAddress || !title || !content) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate admin permissions
    const supabase = createSupabaseAdmin();

    const { data: adminUser, error: adminError } = await supabase
      .from('chat_users')
      .select('role')
      .eq('address', adminAddress.toLowerCase())
      .single();

    if (adminError || !adminUser || !['admin', 'master-admin'].includes(adminUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    // Create announcement
    const { data, error } = await supabase
      .from('chat_announcements')
      .insert({
        title,
        content,
        contributors_only: contributorsOnly ?? false,
        posted_by: adminAddress.toLowerCase(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
