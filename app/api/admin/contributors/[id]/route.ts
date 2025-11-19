import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isAdmin } from '@/lib/chat/permissions';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/admin/contributors/[id]
 * Remove contributor status from a user (admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    if (!adminAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminAddress parameter' },
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

    // Get the contributor to check their current role
    const { data: contributor, error: contributorError } = await supabase
      .from('chat_users')
      .select('role')
      .eq('id', params.id)
      .single();

    if (contributorError || !contributor) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Contributor not found' },
        { status: 404 }
      );
    }

    // Prevent removing admin or master-admin roles
    if (contributor.role === 'admin' || contributor.role === 'master-admin') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Cannot remove admin or master-admin roles' },
        { status: 403 }
      );
    }

    // Downgrade contributor to viewer
    const { error: updateError } = await supabase
      .from('chat_users')
      .update({
        role: 'viewer',
        contributor_type: null,
      })
      .eq('id', params.id);

    if (updateError) {
      console.error('Error removing contributor status:', updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to remove contributor status' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'Contributor status removed successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/contributors/[id]:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
