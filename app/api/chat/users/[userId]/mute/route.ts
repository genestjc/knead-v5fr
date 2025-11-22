import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/users/[userId]/mute
 * Mutes a user, preventing them from posting messages. (Moderator only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userIdToMute = params.userId;

  const supabase = createRouteHandlerClient({ cookies });

  // 1. Get the current authenticated user (the moderator)
  const { data: { user: moderatorUser }, error: authError } = await supabase.auth.getUser();
  if (authError || !moderatorUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Check the moderator's role
  const { data: moderatorProfile, error: profileError } = await supabase
    .from('chat_users')
    .select('role')
    .eq('id', moderatorUser.id)
    .single();

  if (profileError || !['admin', 'master-admin', 'contributor'].includes(moderatorProfile?.role)) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to mute users.' }, { status: 403 });
  }

  // 3. Update the target user's `is_muted` status in the database
  const { error: updateError } = await supabase
    .from('chat_users')
    .update({ is_muted: true })
    .eq('id', userIdToMute);

  if (updateError) {
    console.error('Error muting user:', updateError);
    return NextResponse.json({ error: 'Failed to mute user.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `User ${userIdToMute} has been muted.` });
}
