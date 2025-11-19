import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isAdmin } from '@/lib/chat/permissions';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/contributor-requests/[id]
 * Approve or deny a contributor upgrade request (admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { adminAddress, action, contributorType, reviewNotes } = body;

    if (!adminAddress || !action) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: adminAddress, action' },
        { status: 400 }
      );
    }

    const validActions = ['approve', 'deny'];
    if (!validActions.includes(action)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    if (action === 'approve' && !contributorType) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'contributorType required when approving' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify admin permissions
    const { data: admin, error: adminError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('address', adminAddress.toLowerCase())
      .single();

    if (adminError || !admin) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Admin user not found' },
        { status: 404 }
      );
    }

    const chatAdmin = {
      id: admin.id,
      address: admin.address,
      displayName: admin.display_name,
      avatar: admin.avatar,
      role: admin.role,
      membershipTier: admin.membership_tier,
      contributorType: admin.contributor_type,
      isBanned: admin.is_banned,
      bio: admin.bio,
      alias: admin.alias,
      createdAt: new Date(admin.created_at),
      updatedAt: new Date(admin.updated_at),
    };

    if (!isAdmin(chatAdmin)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Insufficient permissions - admin only' },
        { status: 403 }
      );
    }

    // Get the request
    const { data: request, error: requestError } = await supabase
      .from('contributor_upgrade_requests')
      .select('*')
      .eq('id', params.id)
      .single();

    if (requestError || !request) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }

    if (request.status !== 'pending') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Request has already been reviewed' },
        { status: 400 }
      );
    }

    // Update request status
    const { error: updateRequestError } = await supabase
      .from('contributor_upgrade_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
        review_notes: reviewNotes || null,
      })
      .eq('id', params.id);

    if (updateRequestError) {
      console.error('Error updating request:', updateRequestError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to update request' },
        { status: 500 }
      );
    }

    // If approved, update user role and contributor type
    if (action === 'approve') {
      const { error: updateUserError } = await supabase
        .from('chat_users')
        .update({
          role: 'contributor',
          contributor_type: contributorType,
        })
        .eq('id', request.user_id);

      if (updateUserError) {
        console.error('Error updating user role:', updateUserError);
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Failed to update user role' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: `Request ${action === 'approve' ? 'approved' : 'denied'} successfully`,
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/contributor-requests/[id]:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
