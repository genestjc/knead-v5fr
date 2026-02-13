// app/api/chat/permissions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';

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
    console.log('   Address:', userAddress);

    // Get user role from blockchain NFTs
    const { role } = await getUserRole(userAddress);
    console.log('   Role:', role);

    // Check for active event
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
    console.log('   Event active:', isEventActive);

    // ✅ ENFORCE YOUR RULES:
    let canPost = false;
    let reason = '';

    if (role === 'contributor') {
      // Contributors can ALWAYS post
      canPost = true;
      reason = 'Contributor - full access';
    } else if (role === 'participant') {
      // Participants can ONLY post during active events
      canPost = isEventActive;
      reason = isEventActive 
        ? 'Participant - event active'
        : 'Participants can only chat during live events';
    } else {
      // Freemium can NEVER post
      canPost = false;
      reason = 'Freemium users can only watch';
    }

    console.log('   Can post:', canPost);
    console.log('   Reason:', reason);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json({
      success: true,
      data: {
        role,
        canPost,
        canView: true, // Everyone can view
        canTip: role === 'contributor', // Only contributors can tip
        canDM: role === 'contributor', // Only contributors can DM
        reason,
        isEventActive,
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
