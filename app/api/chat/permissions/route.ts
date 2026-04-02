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

    // Step 1: Get user role from blockchain NFTs
    const roleInfo = await getUserRole(userAddress);
    const { role } = roleInfo;

    // Step 2: Check for active event in Supabase
    const supabase = createSupabaseClient();
    const { data: activeEvents, error: eventError } = await supabase
      .from('chat_events')
      .select('id, title, event_pass_only')
      .eq('status', 'live')
      .limit(1);

    if (eventError) {
      console.error('Event check error:', eventError);
    }

    const isEventActive = !!(activeEvents && activeEvents.length > 0);
    const activeEventId = activeEvents?.[0]?.id || null;
    const eventPassOnly = activeEvents?.[0]?.event_pass_only === true;

    // Step 3: If event is pass-only, check Supabase event_passes table
    let hasEventPass = false;
    if (eventPassOnly && isEventActive && activeEventId) {
      const { data: passRow } = await supabase
        .from('event_passes')
        .select('id')
        .eq('event_id', activeEventId)
        .eq('wallet_address', userAddress.toLowerCase())
        .eq('status', 'active')
        .maybeSingle();
      hasEventPass = !!passRow;
    }

    // Step 4: Enforce business rules
    let canPost = false;
    let reason = '';

    if (eventPassOnly && isEventActive) {
      // Restricted mode: ONLY pass holders can chat — no exceptions for contributors or members
      canPost = hasEventPass;
      reason = canPost
        ? 'Event Pass holder — access granted for this event.'
        : 'This event is restricted to Event Pass holders only.';
    } else if (role === 'contributor') {
      canPost = true;
      reason = 'Contributor - full access';
    } else if (role === 'participant') {
      canPost = isEventActive;
      reason = isEventActive
        ? 'Participant - event active, you can chat!'
        : 'Participants can only chat during live events';
    } else {
      canPost = false;
      reason = 'Freemium users can only watch. Upgrade to Knead Monthly to chat during events!';
    }

    return NextResponse.json({
      success: true,
      data: {
        role,
        canPost,
        canView: true,
        canTip: role === 'contributor',
        canDM: role === 'contributor',
        reason,
        isEventActive,
        activeEventId,
        eventPassOnly,
      },
    });
  } catch (error: any) {
    console.error('Permission check failed:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check permissions' },
      { status: 500 }
    );
  }
}
