import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing address parameter' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    const { data: user, error } = await supabase
      .from('chat_users')
      .select('*')
      .eq('address', address.toLowerCase())
      .single();

    if (error || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      user: {
        id: user.id,
        address: user.address,
        displayName: user.alias || `${user.address.slice(0, 6)}...${user.address.slice(-4)}`,
        alias: user.alias,
        role: user.role,
        membershipTier: user.membership_tier,
        contributorType: user.contributor_type,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/users/by-address:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
