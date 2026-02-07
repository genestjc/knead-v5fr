import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    if (!adminAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminAddress parameter' },
        { status: 400 }
      );
    }

    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;

    // Verify admin
    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS?.toLowerCase()) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Fetch all users
    const { data: users, error } = await supabase
      .from('chat_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    const formattedUsers = users.map((user) => ({
      id: user.id,
      address: user.address,
      displayName: user.display_name,
      alias: user.alias,
      role: user.role,
      membershipTier: user.membership_tier,
      contributorType: user.contributor_type,
      isBanned: user.is_banned,
      createdAt: user.created_at,
    }));

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: formattedUsers,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
