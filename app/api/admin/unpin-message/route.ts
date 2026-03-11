import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { adminAddress, channelId } = await req.json();

    if (!adminAddress || !channelId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: adminAddress, channelId' },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify admin permissions
    const { data: adminUser, error: adminError } = await supabase
      .from('chat_users')
      .select('address, role')
      .eq('address', adminAddress.toLowerCase())
      .single();

    if (adminError || !adminUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin user not found' },
        { status: 401 },
      );
    }

    const allowedRoles = ['master-admin', 'admin'];
    if (!allowedRoles.includes(adminUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Insufficient permissions' },
        { status: 401 },
      );
    }

    // Delete pinned message for this channel
    const { error: deleteError } = await supabase
      .from('chat_pinned_messages')
      .delete()
      .eq('channel_id', channelId);

    if (deleteError) {
      console.error('Error unpinning message:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to unpin message' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unpin message error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
