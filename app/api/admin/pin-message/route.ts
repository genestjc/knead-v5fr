import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { adminAddress, channelId, messageId, messageContent, senderAddress, senderName } =
      await req.json();

    if (!adminAddress || !channelId || !messageId || !messageContent || !senderAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
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

    // Upsert pinned message (replace existing pin for this channel)
    const { data: pinnedMessage, error: upsertError } = await supabase
      .from('chat_pinned_messages')
      .upsert(
        {
          channel_id: channelId,
          message_id: messageId,
          message_content: messageContent,
          sender_address: senderAddress.toLowerCase(),
          sender_name: senderName || null,
          pinned_by: adminAddress.toLowerCase(),
          pinned_at: new Date().toISOString(),
        },
        { onConflict: 'channel_id' },
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Error pinning message:', upsertError);
      return NextResponse.json(
        { success: false, error: 'Failed to pin message' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, pinnedMessage });
  } catch (error) {
    console.error('Pin message error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
