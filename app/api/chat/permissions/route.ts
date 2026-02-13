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
      return NextResponse.json({
        success: false,
        error: 'User address is required',
      }, { status: 400 });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 PERMISSION CHECK');
    console.log('   Address:', userAddress.slice(0, 8) + '...' + userAddress.slice(-6));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: Get user role from blockchain NFTs
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const { role } = await getUserRole(userAddress);
    console.log('   Role from NFTs:', role);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: Check for active event in Supabase
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const supabase = createSupabaseClient();
    const { data: activeEvents, error: eventError } = await supabase
      .from('chat_events')
      .select('*')
      .eq('status', 'live')
      .limit(1);

    if (eventError) {
      console.error('   Event check error:', eventError);
    }

    const isEventActive = activeEvents && activeEvents.length > 0;
    const activeEventId = activeEvents?.[0]?.id;
    
    console.log('   Event active:', isEventActive);
    if (isEventActive) {
      console.log('   Event ID:', activeEventId);
      console.log('   Event title:', activeEvents?.[0]?.title);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: Enforce YOUR business rules
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let canPost = false;
    let reason = '';

    if (role === 'contributor') {
      // ✅ Contributors can ALWAYS post + DM + tip
      canPost = true;
      reason = 'Contributor - full access';
    } else if (role === 'participant') {
      // ✅ Participants can ONLY post during active events
      canPost = isEventActive;
      reason = isEventActive 
        ? 'Participant - event active, you can chat!'
        : 'Participants can only chat during live events';
    } else {
      // ✅ Freemium can NEVER post (watch only)
      canPost = false;
      reason = 'Freemium users can only watch. Upgrade to Knead Monthly to chat during events!';
    }

    console.log('   Can post:', canPost);
    console.log('   Reason:', reason);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json({
      success: true,
      data: {
        role,
        canPost,
        canView: true, // Everyone can view messages
        canTip: role === 'contributor', // Only contributors can tip
        canDM: role === 'contributor', // Only contributors can DM
        reason,
        isEventActive,
        activeEventId: activeEventId || null,
      },
    });

  } catch (error: any) {
    console.error('❌ Permission check failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to check permissions',
    }, { status: 500 });
  }
}
