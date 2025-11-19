import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ChatUser } from '@/types/chat';

// Master admin wallet address
const MASTER_ADMIN_ADDRESS = '0xf27dafdd875759c4f21ddcd4b8a68e86e8e6206e';

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase client inside the function
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { address, membershipTier } = await req.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();

    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('address', normalizedAddress)
      .single();

    if (existingUser && !fetchError) {
      // User exists - return it as ChatUser type
      const user: ChatUser = {
        id: existingUser.id,
        address: existingUser.address,
        displayName: existingUser.alias || existingUser.display_name || `${address.slice(0, 6)}...${address.slice(-4)}`,
        avatar: existingUser.avatar,
        role: existingUser.role,
        membershipTier: existingUser.membership_tier,
        contributorType: existingUser.contributor_type,
        isBanned: existingUser.is_banned,
        bio: existingUser.bio,
        alias: existingUser.alias,
        createdAt: new Date(existingUser.created_at),
        updatedAt: new Date(existingUser.updated_at),
      };

      return NextResponse.json({
        success: true,
        user,
        isNew: false,
      });
    }

    // User doesn't exist - create new user
    // Determine role based on wallet address
    const isMasterAdmin = normalizedAddress === MASTER_ADMIN_ADDRESS.toLowerCase();
    const role = isMasterAdmin ? 'master-admin' : 'viewer';
    
    const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`;

    const { data: newUser, error: createError } = await supabase
      .from('chat_users')
      .insert({
        address: normalizedAddress,
        display_name: displayName,
        role: role,
        membership_tier: membershipTier || 'freemium',
        is_banned: false,
      })
      .select()
      .single();

    if (createError || !newUser) {
      console.error('Error creating user:', createError);
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    const user: ChatUser = {
      id: newUser.id,
      address: newUser.address,
      displayName: newUser.display_name,
      avatar: newUser.avatar,
      role: newUser.role,
      membershipTier: newUser.membership_tier,
      contributorType: newUser.contributor_type,
      isBanned: newUser.is_banned,
      bio: newUser.bio,
      alias: newUser.alias,
      createdAt: new Date(newUser.created_at),
      updatedAt: new Date(newUser.updated_at),
    };

    return NextResponse.json({
      success: true,
      user,
      isNew: true,
    });
  } catch (error) {
    console.error('Error in get-or-create-user:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get or create user',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
