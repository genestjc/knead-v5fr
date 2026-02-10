// app/api/admin/chat/delete-message/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { adminAddress, messageId } = await req.json();

    // Verify admin
    const MASTER_ADMIN = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;
    if (adminAddress.toLowerCase() !== MASTER_ADMIN?.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseClient();

    // Insert deleted message record (for audit trail)
    await supabase.from('deleted_messages').insert({
      message_id: messageId,
      deleted_by: adminAddress,
      deleted_at: new Date().toISOString(),
    });

    // TODO: Actually delete from Towns Protocol
    // For now, just mark as deleted in your database

    console.log('🗑️ Message deleted:', messageId);

    return NextResponse.json({
      success: true,
      message: 'Message deleted',
    });

  } catch (error: any) {
    console.error('❌ Delete message error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete message' },
      { status: 500 }
    );
  }
}
