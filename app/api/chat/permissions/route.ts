import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, checkFreemiumTimeRemaining } from '@/lib/supabase/chat-client';
import { canViewChannel, canPostInChannel, isAdmin } from '@/lib/chat/permissions'; // CORRECTED IMPORT
import type { ApiResponse, UserPermissions } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing userId parameter' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: user, error: userError } = await supabase.from('chat_users').select('*').eq('id', userId).single();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    // --- REFACTORED LOGIC ---
    const [canView, canPost] = await Promise.all([
      canViewChannel(userId),
      canPostInChannel(userId)
    ]);
    
    const userIsAdmin = isAdmin(user);

    let freemiumMinutesUsed = 0;
    if (user.membership_tier === 'freemium') {
        const timeRemaining = await checkFreemiumTimeRemaining(userId);
        freemiumMinutesUsed = 60 - timeRemaining;
    }
    
    const finalPermissions: UserPermissions = {
        canView,
        canPost,
        canDelete: userIsAdmin,
        canEdit: userIsAdmin,
        isBanned: user.is_banned,
        membershipTier: user.membership_tier,
        role: user.role,
        contributorType: user.contributor_type,
        freemiumMinutesUsed,
    };
    // --- END REFACTOR ---

    return NextResponse.json<ApiResponse<UserPermissions>>({
      success: true,
      data: finalPermissions,
    });
  } catch (error) {
    console.error('Error in GET /api/chat/permissions:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
