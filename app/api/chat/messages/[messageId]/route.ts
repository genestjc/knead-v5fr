import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/chat/messages/[messageId]
 * Deletes a specific chat message.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  const { messageId } = params;
  if (!messageId) {
    return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });

  // 1. Get the current authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get the current user's profile to check their role
  const { data: userProfile, error: profileError } = await supabase
    .from('chat_users')
    .select('id, role')
    .eq('id', user.id)
    .single();
  
  if (profileError || !userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  // 3. Get the message to verify ownership
  const { data: message, error: messageError } = await supabase
    .from('chat_messages')
    .select('id, userId')
    .eq('id', messageId)
    .single();

  if (messageError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  // 4. Check permissions: User must be a moderator OR the author of the message
  const isModerator = ['admin', 'master-admin', 'contributor'].includes(userProfile.role);
  const isAuthor = message.userId === userProfile.id;

  if (!isModerator && !isAuthor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 5. Perform the deletion
  const { error: deleteError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('id', messageId);

  if (deleteError) {
    console.error('Error deleting message:', deleteError);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
  
  // Note: For a fully real-time experience, the client should also listen for DELETE events from Supabase.
  return NextResponse.json({ success: true, message: 'Message deleted' });
}
