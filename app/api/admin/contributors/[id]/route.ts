import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';
import { ADMIN_AUTH_HEADERS } from '@/lib/admin/message';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Revoking a contributor triggers an on-chain burn, so require the master wallet.
    const auth = await verifyAdminRequest(req, { requireMaster: true });
    if (!auth.ok) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: auth.error
      }, { status: auth.status });
    }

    const supabase = createSupabaseAdmin();

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
    
    // Call burn API, forwarding this request's admin signature so the
    // downstream master-only check passes without a second wallet prompt.
    const burnResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/burn-contributor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [ADMIN_AUTH_HEADERS.address]: req.headers.get(ADMIN_AUTH_HEADERS.address) ?? '',
        [ADMIN_AUTH_HEADERS.timestamp]: req.headers.get(ADMIN_AUTH_HEADERS.timestamp) ?? '',
        [ADMIN_AUTH_HEADERS.signature]: req.headers.get(ADMIN_AUTH_HEADERS.signature) ?? '',
      },
      body: JSON.stringify({
        ownerAddress: userToRevoke.address,
        tokenId,
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
