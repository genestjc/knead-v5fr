import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export async function POST(req: NextRequest) {
  try {
    const { userId, userAddress, alias, avatar } = await req.json();

    // ✅ Allow either userId OR userAddress (more flexible)
    if (!userId && !userAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required field: userId or userAddress' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // ✅ If only userAddress provided, look up the user first
    let finalUserId = userId;
    
    if (!finalUserId && userAddress) {
      const { data: user, error: lookupError } = await supabase
        .from('chat_users')
        .select('id')
        .eq('address', userAddress.toLowerCase())
        .single();

      if (lookupError || !user) {
        console.error('Error looking up user:', lookupError);
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      finalUserId = user.id;
    }

    // Update user profile
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (alias !== undefined) updateData.alias = alias || null;
    if (avatar !== undefined) updateData.avatar = avatar || null;

    const { error } = await supabase
      .from('chat_users')
      .update(updateData)
      .eq('id', finalUserId);

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    console.log('✅ Profile updated for user:', finalUserId);

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
