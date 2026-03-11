import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: channelId' },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdmin();

    const { data: pinnedMessage, error } = await supabase
      .from('chat_pinned_messages')
      .select('*')
      .eq('channel_id', channelId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching pinned message:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch pinned message' },
        { status: 500 },
      );
    }

    if (!pinnedMessage) {
      return NextResponse.json({ success: true, pinnedMessage: null });
    }

    return NextResponse.json({
      success: true,
      pinnedMessage: {
        id: pinnedMessage.id,
        messageId: pinnedMessage.message_id,
        content: pinnedMessage.message_content,
        senderName: pinnedMessage.sender_name,
        senderAddress: pinnedMessage.sender_address,
        pinnedBy: pinnedMessage.pinned_by,
        pinnedAt: pinnedMessage.pinned_at,
      },
    });
  } catch (error) {
    console.error('Fetch pinned message error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
