import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';
import type { ApiResponse, SimpleChatPermissions } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing userAddress parameter' }, { status: 400 });
    }

    // Get role from NFT ownership (includes Event Pass check)
    const roleInfo = await getUserRole(userAddress);
    
    // Check if there's currently a live event
    const supabase = createSupabaseAdmin();
    const { data: liveEvents } = await supabase
      .from('chat_events')
      .select('id, title')
      .eq('status', 'live')
      .limit(1);

    const hasLiveEvent = Boolean(liveEvents && liveEvents.length > 0);
    
    // ✅ NEW: Log Event Pass status
    console.log('[Permissions]', {
      address: userAddress.slice(0, 8) + '...',
      role: roleInfo.role,
      hasEventPass: roleInfo.hasEventPass,
      eventId: roleInfo.eventId,
      hasLiveEvent,
    });
    
    // Determine permissions
    const canView = true; // All users can view (freemium has timer)
    
    // ✅ Contributors can always post
    // ✅ Participants can post if they have Event Pass OR there's a live event
    const canPost = roleInfo.role === 'contributor' || 
                    (roleInfo.role === 'participant' && (roleInfo.hasEventPass || hasLiveEvent));
    
    const userIsAdmin = roleInfo.role === 'contributor';
    
    let freemiumMinutesUsed = 0;
    if (roleInfo.role === 'freemium') {
      const { data, error } = await supabase.rpc('get_freemium_chat_time_remaining', {
        p_wallet_address: userAddress.toLowerCase(),
      });
      
      if (!error && data !== null) {
        freemiumMinutesUsed = Math.floor((3600 - data) / 60);
      }
    }
    
    const finalPermissions: SimpleChatPermissions = {
        canView,
        canPost,
        canDelete: userIsAdmin,
        canEdit: userIsAdmin,
        isBanned: false,
        membershipTier: roleInfo.role === 'contributor' ? 'contributor' : roleInfo.role === 'participant' ? 'premium' : 'freemium',
        role: roleInfo.role,
        contributorType: roleInfo.hasContributor ? 'invited' : null,
        freemiumMinutesUsed,
    };

    return NextResponse.json<ApiResponse<SimpleChatPermissions>>({
      success: true,
      data: finalPermissions,
    });
  } catch (error) {
    console.error('Error in GET /api/chat/permissions:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
