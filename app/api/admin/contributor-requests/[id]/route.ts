import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isAdmin } from '@/lib/chat/permissions';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { adminAddress, action, contributorType, reviewNotes } = body;

    if (!adminAddress || !action || (action === 'approve' && !contributorType)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing required fields.' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify admin permissions (simplified)
    const { data: admin } = await supabase.from('chat_users').select('*').eq('address', adminAddress.toLowerCase()).single();
    if (!admin || !isAdmin({ role: admin.role })) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get the request and the user's address associated with it
    const { data: request, error: requestError } = await supabase
      .from('contributor_upgrade_requests')
      .select('*, user:chat_users!user_id(address)')
      .eq('id', params.id)
      .single();

    if (requestError || !request) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Request not found' }, { status: 404 });
    }
    if (request.status !== 'pending') {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Request already reviewed' }, { status: 400 });
    }

    // --- REFACTORED LOGIC ---
    if (action === 'approve') {
      // 1. Call our new minting API
      const mintResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/mint-contributor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              recipientAddress: request.user.address,
              role: contributorType,
              adminAddress: admin.address // Pass admin address for verification
          }),
      });

      const mintData = await mintResponse.json();
      if (!mintData.success) {
          throw new Error(`On-chain minting failed: ${mintData.error}`);
      }
      
      // 2. Update the request status to 'approved'
      await supabase.from('contributor_upgrade_requests').update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: admin.id,
          review_notes: reviewNotes || null,
      }).eq('id', params.id);

      return NextResponse.json<ApiResponse<null>>({ success: true, message: `Request approved and NFT minted successfully.` });

    } else { // Action is 'deny'
        // Just update the request status
        await supabase.from('contributor_upgrade_requests').update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reviewed_by: admin.id,
            review_notes: reviewNotes || null,
        }).eq('id', params.id);

        return NextResponse.json<ApiResponse<null>>({ success: true, message: `Request denied successfully.` });
    }

  } catch (error) {
    console.error('Error in PATCH /api/admin/contributor-requests/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse<null>>({ success: false, error: errorMessage }, { status: 500 });
  }
}
