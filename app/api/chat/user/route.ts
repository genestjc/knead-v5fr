import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

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
      .select('id, address, display_name, alias, avatar, role, membership_tier, contributor_type, is_banned, bio, created_at, updated_at')
      .eq('address', address.toLowerCase())
      .single();

    if (error || !user) {
      // User doesn't exist - return minimal data
      return NextResponse.json({
        success: true,
        user: {
          address: address.toLowerCase(),
          displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
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
        displayName: user.alias || user.display_name || `${address.slice(0, 6)}...${address.slice(-4)}`,
        alias: user.alias,
        avatar: user.avatar,
        role: user.role,
        membershipTier: user.membership_tier,
        contributorType: user.contributor_type,
        isBanned: user.is_banned,
        bio: user.bio,
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
