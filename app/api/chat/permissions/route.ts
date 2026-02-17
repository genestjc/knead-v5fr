import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Permission Check API
 *
 * Enforces app-side business logic:
 * - Freemium: Watch only (never post)
 * - Participant: Post during events only
 * - Contributor: Always post + DM + tip
 *
 * Note: Towns Protocol permissions (on-chain) are separate.
 * Everyone has Read+Write on-chain. This API enforces YOUR rules.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json(
        { success: false, error: 'User address is required' },
        { status: 400 },
      );
    }

    // Step 1: Get user role from blockchain NFTs
    const { role } = await getUserRole(userAddress);

    // Step 2: Check for active event in Supabase
    const supabase = createSupabaseClient();
    const { data: activeEvents, error: eventError } = await supabase
      .from('chat_events')
      .select('id, title')
      .eq('status', 'live')
      .limit(1);

    if (eventError) {
      console.error('Event check error:', eventError);
    }

    const isEventActive = !!(activeEvents && activeEvents.length > 0);
    const activeEventId = activeEvents?.[0]?.id || null;

    // Step 3: Enforce business rules
    let canPost = false;
    let reason = '';

    if (role === 'contributor') {
      canPost = true;
      reason = 'Contributor - full access';
    } else if (role === 'participant') {
      canPost = isEventActive;
      reason = isEventActive
        ? 'Participant - event active, you can chat!'
        : 'Participants can only chat during live events';
    } else {
      canPost = false;
      reason =
        'Freemium users can only watch. Upgrade to Knead Monthly to chat during events!';
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
      },
    });
  } catch (error: any) {
    console.error('Permission check failed:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check permissions' },
      { status: 500 },
    );
  }
}
