import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export async function POST(req: NextRequest) {
  try {
    const { userId, userAddress, alias, avatar } = await req.json();

    if (!userId || !userAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: userId and userAddress' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Update user profile
    const { error } = await supabase
      .from('chat_users')
      .update({
        alias: alias || null,
        avatar: avatar || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .eq('address', userAddress.toLowerCase());

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    console.log('✅ Profile updated for user:', userId);

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
