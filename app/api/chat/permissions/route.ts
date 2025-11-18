import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, checkFreemiumTimeRemaining } from '@/lib/supabase/chat-client';
import { getUserPermissions } from '@/lib/chat/permissions';
import { getTierFromPoints } from '@/lib/chat/config';
import type { ApiResponse, UserPermissions } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/permissions
 * Get complete permissions object for a user
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const channelId = searchParams.get('channelId') || 'general';

    if (!userId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Get user
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const chatUser = {
      id: user.id,
      address: user.address,
      displayName: user.display_name,
      avatar: user.avatar,
      role: user.role,
      membershipTier: user.membership_tier,
      contributorType: user.contributor_type,
      isBanned: user.is_banned,
      bio: user.bio,
      alias: user.alias,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    };

    // Get freemium time remaining if applicable
    let freemiumMinutesUsed = 0;
    if (user.membership_tier === 'freemium') {
      const timeRemaining = await checkFreemiumTimeRemaining(userId);
      freemiumMinutesUsed = 60 - timeRemaining;
    }

    // Get distribution budget for contributors
    let distributionBudget = 0;
    if (user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
      const { data: budgetData } = await supabase
        .from('contributor_daily_budgets')
        .select('remaining_points')
        .eq('user_id', userId)
        .gte('date', new Date().toISOString().split('T')[0])
        .single();

      distributionBudget = budgetData?.remaining_points || 100;
    }

    // Get personal earnings for contributors
    let personalEarnings = 0;
    if (user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
      const { data: walletData } = await supabase
        .from('participant_wallets')
        .select('available_balance')
        .eq('user_id', userId)
        .single();

      personalEarnings = walletData?.available_balance || 0;
    }

    // Get total points for participants
    let totalPoints = 0;
    if (user.role === 'viewer') {
      const { data: walletData } = await supabase
        .from('participant_wallets')
        .select('total_earned')
        .eq('user_id', userId)
        .single();

      totalPoints = walletData?.total_earned || 0;
    }

    // Get complete permissions
    const permissions = getUserPermissions(
      chatUser,
      channelId,
      freemiumMinutesUsed,
      distributionBudget,
      personalEarnings,
      totalPoints
    );

    return NextResponse.json<ApiResponse<UserPermissions>>({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error('Error in GET /api/chat/permissions:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
