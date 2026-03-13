import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { addresses } = await request.json();

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid addresses array' },
        { status: 400 }
      );
    }

    console.log('📦 Batch fetching profiles for', addresses.length, 'addresses');

    // Normalize addresses to lowercase for consistent lookup
    const normalizedAddresses = addresses.map(addr => addr.toLowerCase());

    // Fetch all profiles in a single query
    const { data: users, error } = await supabase
      .from('chat_users')
      .select('address, alias, avatar, role, created_at')
      .in('address', normalizedAddresses);

    if (error) {
      console.error('❌ Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    // Build a map of address -> profile
    const profiles: Record<string, {
      alias: string | null;
      avatar: string | null;
      role?: string;
    }> = {};

    // Add found profiles
    (users || []).forEach(user => {
      profiles[user.address.toLowerCase()] = {
        alias: user.alias,
        avatar: user.avatar,
        role: user.role,
      };
    });

    // For addresses not in database, add null entries
    normalizedAddresses.forEach(address => {
      if (!profiles[address]) {
        profiles[address] = {
          alias: null,
          avatar: null,
        };
      }
    });

    console.log('✅ Batch profiles fetched:', Object.keys(profiles).length);

    return NextResponse.json({
      success: true,
      profiles,
    });

  } catch (error) {
    console.error('❌ Batch profile fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
