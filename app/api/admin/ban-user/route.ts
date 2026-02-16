// app/api/admin/ban-user/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userAddress, adminAddress, ban } = await req.json();

    // Validation
    if (!userAddress || !adminAddress || ban === undefined) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Missing required fields: userAddress, adminAddress, ban' 
      }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Check if caller has admin or moderator role in DB
    const { data: adminUser, error: adminError } = await supabase
      .from('chat_users')
      .select('address, role')
      .eq('address', adminAddress.toLowerCase())
      .single();

    if (adminError || !adminUser) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Unauthorized: Admin user not found' 
      }, { status: 401 });
    }

    const allowedRoles = ['master-admin', 'admin', 'moderator'];
    if (!allowedRoles.includes(adminUser.role)) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Unauthorized: Insufficient permissions' 
      }, { status: 401 });
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('address, role, id')
      .eq('address', userAddress.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Prevent banning admins
    if (user.role === 'admin' || user.role === 'master-admin') {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Cannot ban admin users' 
      }, { status: 403 });
    }

    // ✅ Update database ban status (your existing working logic)
    const { error: updateError } = await supabase
      .from('chat_users')
      .update({ is_banned: ban })
      .eq('address', userAddress.toLowerCase());

    if (updateError) {
      console.error('Error updating ban status:', updateError);
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Failed to update ban status' 
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<null>>({ 
      success: true, 
      message: ban 
        ? 'User banned from chat successfully' 
        : 'User unbanned successfully'
    });

  } catch (error) {
    console.error('Ban/unban error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse<null>>({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
