// app/api/admin/chat/delete-message/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { deleteMessageFromTowns } from '@/lib/towns/admin-actions';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { adminAddress, messageId, channelId } = await req.json();

    // Verify admin
    const MASTER_ADMIN = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;
    if (adminAddress.toLowerCase() !== MASTER_ADMIN?.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!messageId || !channelId) {
      return NextResponse.json(
        { error: 'Missing messageId or channelId' }, 
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // ✅ Step 1: Delete from Towns Protocol
    try {
      await deleteMessageFromTowns(channelId, messageId);
      console.log('✅ Message deleted from Towns Protocol');
    } catch (townsError: any) {
      console.error('❌ Failed to delete from Towns:', townsError);
      return NextResponse.json(
        { error: `Failed to delete from Towns Protocol: ${townsError.message}` },
        { status: 500 }
      );
    }

    // ✅ Step 2: Record deletion in database (audit trail)
    const { error: dbError } = await supabase.from('deleted_messages').insert({
      message_id: messageId,
      channel_id: channelId,
      deleted_by: adminAddress,
      deleted_at: new Date().toISOString(),
    });

    if (dbError) {
      console.warn('⚠️ Failed to record deletion in database:', dbError);
      // Continue anyway - message is already deleted from Towns
    }

    return NextResponse.json({
      success: true,
      message: 'Message deleted from Towns Protocol',
    });

  } catch (error: any) {
    console.error('❌ Delete message error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete message' },
      { status: 500 }
    );
  }
}
