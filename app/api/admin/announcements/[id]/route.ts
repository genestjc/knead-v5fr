import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ← Change to Promise
) {
  try {
    const { id } = await params; // ← Await params
    const searchParams = request.nextUrl.searchParams;
    const adminAddress = searchParams.get('adminAddress');

    if (!adminAddress) {
      return NextResponse.json(
        { success: false, error: 'Admin address required' },
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
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete announcement
    const { error } = await supabase
      .from('chat_announcements')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete error:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE announcement error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
