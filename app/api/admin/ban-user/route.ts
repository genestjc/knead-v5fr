// app/api/admin/chat/ban-user/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { banUserFromTowns, unbanUserFromTowns } from '@/lib/towns/admin-actions';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userAddress, adminAddress, ban, spaceId } = await req.json();
    
    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;

    // Validation
    if (!userAddress || !adminAddress || ban === undefined) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Missing required fields: userAddress, adminAddress, ban' 
      }, { status: 400 });
    }

    // Verify admin
    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS?.toLowerCase()) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();

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

    // ✅ Step 1: Update database ban status
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

    // ✅ Step 2: Ban from Towns Protocol (if spaceId provided)
    if (spaceId) {
      try {
        if (ban) {
          await banUserFromTowns(user.id, spaceId);
          console.log('✅ User banned from Towns Protocol');
        } else {
          await unbanUserFromTowns(user.id, spaceId);
          console.log('✅ User unbanned from Towns Protocol');
        }
      } catch (townsError: any) {
        console.error('⚠️ Towns Protocol ban/unban failed:', townsError);
        // Return error since Towns integration is critical
        return NextResponse.json<ApiResponse<null>>({ 
          success: false, 
          error: `Database updated but Towns Protocol ban failed: ${townsError.message}` 
        }, { status: 500 });
      }
    }

    return NextResponse.json<ApiResponse<null>>({ 
      success: true, 
      message: ban 
        ? 'User banned from chat and Towns Protocol successfully' 
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
