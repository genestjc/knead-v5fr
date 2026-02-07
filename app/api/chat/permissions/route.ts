import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, checkFreemiumTimeRemaining } from '@/lib/supabase/chat-client';
import { canViewChannel, canPostInChannel, isAdmin } from '@/lib/chat/permissions'; // CORRECTED IMPORT
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';
import type { ApiResponse, UserPermissions } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing userAddress parameter' }, { status: 400 });
    }

    // Get role from NFT ownership
    const roleInfo = await getUserRole(userAddress);
    
    // Determine permissions based on NFT role
    const canView = true; // All users can view (freemium has timer)
    const canPost = roleInfo.role === 'participant' || roleInfo.role === 'contributor';
    const userIsAdmin = roleInfo.role === 'contributor'; // Contributors are moderators
    
    let freemiumMinutesUsed = 0;
    if (roleInfo.role === 'freemium') {
      // Get freemium time from Supabase
      const supabase = createSupabaseAdmin();
      const { data, error } = await supabase.rpc('get_freemium_chat_time_remaining', {
        p_wallet_address: userAddress.toLowerCase(),
      });
      
      if (!error && data !== null) {
        freemiumMinutesUsed = Math.floor((3600 - data) / 60);
      }
    }
    
    const finalPermissions: UserPermissions = {
        canView,
        canPost,
        canDelete: userIsAdmin,
        canEdit: userIsAdmin,
        isBanned: false, // TODO: Add on-chain ban list if needed
        membershipTier: roleInfo.role === 'contributor' ? 'contributor' : roleInfo.role === 'participant' ? 'premium' : 'freemium',
        role: roleInfo.role,
        contributorType: roleInfo.hasContributor ? 'invited' : null,
        freemiumMinutesUsed,
    };

    return NextResponse.json<ApiResponse<UserPermissions>>({
      success: true,
      data: finalPermissions,
    });
  } catch (error) {
    console.error('Error in GET /api/chat/permissions:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
