import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isAdmin } from '@/lib/chat/permissions';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    if (!adminAddress) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Missing adminAddress parameter' 
      }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify admin permissions
    const { data: admin } = await supabase
      .from('chat_users')
      .select('*')
      .eq('address', adminAddress.toLowerCase())
      .single();
      
    if (!admin || !isAdmin({ role: admin.role })) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, { status: 403 });
    }

    // Get the user to be revoked
    const { data: userToRevoke, error: userError } = await supabase
      .from('chat_users')
      .select('id, address, contributor_type')
      .eq('id', params.id)
      .single();

    if (userError || !userToRevoke) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Contributor not found' 
      }, { status: 404 });
    }

    // ✅ FIXED: Changed from 10/11/12 to 1/2/3
    const roleToTokenId: Record<string, number> = {
      'appointed': 1,
      'invited': 2,
      'earned': 3,
    };
    
    const tokenId = userToRevoke.contributor_type ? roleToTokenId[userToRevoke.contributor_type] : null;

    if (!tokenId) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'User is not a contributor or type is unknown.' 
      }, { status: 400 });
    }
    
    // Call burn API
    const burnResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/burn-contributor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: userToRevoke.address,
        tokenId,
        adminAddress: admin.address
      }),
    });

    const burnData = await burnResponse.json();
    if (!burnData.success) {
      throw new Error(`On-chain burn failed: ${burnData.error}`);
    }

    return NextResponse.json<ApiResponse<null>>({ 
      success: true, 
      message: 'Contributor status revoked successfully.' 
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/contributors/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse<null>>({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
