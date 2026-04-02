import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export async function POST(req: NextRequest) {
  try {
    const { userId, userAddress, alias, avatar, bio } = await req.json();

    console.log('📥 Update profile request:', { userId, userAddress, hasAlias: !!alias, hasAvatar: !!avatar, hasBio: !!bio });

    // ✅ Require at least userAddress
    if (!userAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required field: userAddress' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // ✅ Always look up user by address
    console.log('🔍 Looking up user by address:', userAddress.toLowerCase());
    
    const { data: user, error: lookupError } = await supabase
      .from('chat_users')
      .select('id, address, alias, avatar')
      .eq('address', userAddress.toLowerCase())
      .maybeSingle();

    if (lookupError) {
      console.error('❌ Database lookup error:', lookupError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Database error: ${lookupError.message}` },
        { status: 500 }
      );
    }

    let finalUserId: string;

    if (!user) {
      // ✅ User doesn't exist - create them first
      console.log('👤 User not found, creating new user record...');
      
      const { data: newUser, error: createError } = await supabase
        .from('chat_users')
        .insert({
          address: userAddress.toLowerCase(),
          alias: alias || null,
          avatar: avatar || null,
          bio: bio || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (createError || !newUser) {
        console.error('❌ Error creating user:', createError);
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Failed to create user profile' },
          { status: 500 }
        );
      }

      finalUserId = newUser.id;
      console.log('✅ Created new user:', finalUserId);

      return NextResponse.json<ApiResponse<null>>({
        success: true,
        message: 'Profile created successfully',
      });
    }

    // ✅ User exists - update their profile
    finalUserId = user.id;
    console.log('✅ Found existing user:', { id: user.id, address: user.address });

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (alias !== undefined) updateData.alias = alias || null;
    if (avatar !== undefined) updateData.avatar = avatar || null;
    if (bio !== undefined) updateData.bio = bio || null;

    console.log('💾 Updating user with data:', updateData);

    const { error: updateError } = await supabase
      .from('chat_users')
      .update(updateData)
      .eq('id', finalUserId);

    if (updateError) {
      console.error('❌ Error updating profile:', updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    console.log('✅ Profile updated successfully for user:', finalUserId);

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
