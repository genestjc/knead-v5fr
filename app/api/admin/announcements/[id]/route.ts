import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ← Change to Promise
) {
  try {
    const { id } = await params; // ← Await params

    const auth = await verifyAdminRequest(request, { allowedRoles: ['admin', 'master-admin'] });
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const supabase = createSupabaseAdmin();

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
