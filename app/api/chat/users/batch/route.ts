import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/users/batch
 * Fetch multiple user profiles by wallet addresses in one call
 * Body: { addresses: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const { addresses } = await req.json();

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid addresses array' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();
    
    // Fetch all users in one query
    const { data: users, error } = await supabase
      .from('chat_users')
      .select('address, alias, avatar')
      .in('address', addresses.map(a => a.toLowerCase()));

    if (error) {
      console.error('Error fetching batch users:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Create a map of address -> profile
    const profileMap: Record<string, { alias: string | null; avatar: string | null }> = {};
    
    users?.forEach(user => {
      profileMap[user.address] = {
        alias: user.alias,
        avatar: user.avatar,
      };
    });

    return NextResponse.json({
      success: true,
      profiles: profileMap,
    });
  } catch (error) {
    console.error('Error in batch fetch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
