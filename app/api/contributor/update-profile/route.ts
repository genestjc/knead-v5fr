import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export async function POST(req: NextRequest) {
  try {
    const { userId, userAddress, alias, avatar } = await req.json();

    console.log('📥 Update profile request:', { userId, userAddress, hasAlias: !!alias, hasAvatar: !!avatar });

    // ✅ Require at least userAddress
    if (!userAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required field: userAddress' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // ✅ Always look up user by address (more reliable than trusting userId)
    // The userId from the client might be a wallet address or incorrect
    console.log('🔍 Looking up user by address:', userAddress.toLowerCase());
    
    const { data: user, error: lookupError } = await supabase
      .from('chat_users')
      .select('id, address, alias, avatar')
      .eq('address', userAddress.toLowerCase())
      .maybeSingle(); // ✅ Changed from .single() to .maybeSingle()

    if (lookupError) {
      console.error('❌ Database lookup error:', lookupError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Database error: ${lookupError.message}` },
        { status: 500 }
      );
    }

    if (!user) {
      console.error('❌ User not found in database for address:', userAddress);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('✅ Found user:', { id: user.id, address: user.address });

    // Update user profile
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (alias !== undefined) updateData.alias = alias || null;
    if (avatar !== undefined) updateData.avatar = avatar || null;

    console.log('💾 Updating user with data:', updateData);

    const { error } = await supabase
      .from('chat_users')
      .update(updateData)
      .eq('id', user.id);

    if (error) {
      console.error('❌ Error updating profile:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    console.log('✅ Profile updated successfully for user:', user.id);

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
