import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { formatAddressForDisplay } from '@/lib/utils/transformers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/user?address=0x...
 * Fetch user profile by wallet address
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Missing address parameter' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();
    
    const { data: user, error } = await supabase
      .from('chat_users')
      .select('id, address, alias, avatar, role, membership_tier, contributor_type, is_banned, bio, welcome_seen, contributor_welcome_seen, created_at, updated_at')
      .eq('address', address.toLowerCase())
      .single();

    if (error || !user) {
      // User doesn't exist - return minimal data
      return NextResponse.json({
        success: true,
        user: {
          address: address.toLowerCase(),
          displayName: formatAddressForDisplay(address),
          alias: null,
          avatar: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        address: user.address,
        displayName: user.alias || formatAddressForDisplay(user.address),
        alias: user.alias,
        avatar: user.avatar,
        role: user.role,
        membershipTier: user.membership_tier,
        contributorType: user.contributor_type,
        isBanned: user.is_banned,
        bio: user.bio,
        welcomeSeen: user.welcome_seen ?? false,
        contributorWelcomeSeen: user.contributor_welcome_seen ?? false,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
