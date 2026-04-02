import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json({ success: false, error: 'User address is required' }, { status: 400 });
    }

    const roleInfo = await getUserRole(userAddress);
    const { role } = roleInfo;

    const supabase = createSupabaseClient();
    const { data: activeEvents, error: eventError } = await supabase
      .from('chat_events')
      .select('id, title, event_pass_only')
      .eq('status', 'live')
      .limit(1);

    if (eventError) console.error('Event check error:', eventError);

    const isEventActive = !!(activeEvents && activeEvents.length > 0);
    const activeEventId = activeEvents?.[0]?.id || null;
    const eventPassOnly = activeEvents?.[0]?.event_pass_only === true;

    // Always check event_passes — pass holders can chat regardless of toggle
    let hasEventPass = false;
    if (isEventActive && activeEventId) {
      const { data: passRow } = await supabase
        .from('event_passes')
        .select('id')
        .eq('event_id', activeEventId)
        .eq('wallet_address', userAddress.toLowerCase())
        .eq('status', 'active')
        .maybeSingle();
      hasEventPass = !!passRow;
    }

    let canPost = false;
    let reason = '';

    if (eventPassOnly && isEventActive) {
      // Restricted: ONLY pass holders — contributors and members locked out too
      canPost = hasEventPass;
      reason = canPost
        ? 'Event Pass holder — access granted for this event.'
        : 'This event is restricted to Event Pass holders only.';
    } else if (role === 'contributor') {
      canPost = true;
      reason = 'Contributor - full access';
    } else if (role === 'participant' || hasEventPass) {
      // Pass holders always get to chat during their event
      canPost = isEventActive;
      reason = isEventActive
        ? hasEventPass ? 'Event Pass holder — access granted.' : 'Participant - event active, you can chat!'
        : 'Participants can only chat during live events';
    } else {
      canPost = false;
      reason = 'Freemium users can only watch. Upgrade to Knead Monthly to chat during events!';
    }

    return NextResponse.json({
      success: true,
      data: { role, canPost, canView: true, canTip: role === 'contributor', canDM: role === 'contributor', reason, isEventActive, activeEventId, eventPassOnly, hasEventPass },
    });
  } catch (error: any) {
    console.error('Permission check failed:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Failed to check permissions' }, { status: 500 });
  }
}
