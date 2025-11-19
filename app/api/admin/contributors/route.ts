import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isAdmin } from '@/lib/chat/permissions';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/contributors
 * List all contributors (admin only)
 */
export async function GET(req: NextRequest) {
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
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('address', adminAddress.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const chatUser = {
      id: user.id,
      address: user.address,
      displayName: user.display_name,
      avatar: user.avatar,
      role: user.role,
      membershipTier: user.membership_tier,
      contributorType: user.contributor_type,
      isBanned: user.is_banned,
      bio: user.bio,
      alias: user.alias,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    };

    if (!isAdmin(chatUser)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Insufficient permissions - admin only' },
        { status: 403 }
      );
    }

    // Fetch all contributors
    const { data: contributors, error } = await supabase
      .from('chat_users')
      .select('*')
      .in('role', ['contributor', 'admin', 'master-admin'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contributors:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch contributors' },
        { status: 500 }
      );
    }

    const formattedContributors = contributors.map((c) => ({
      id: c.id,
      address: c.address,
      displayName: c.alias || c.display_name,
      avatar: c.avatar,
      role: c.role,
      membershipTier: c.membership_tier,
      contributorType: c.contributor_type,
      bio: c.bio,
      alias: c.alias,
      createdAt: new Date(c.created_at),
    }));

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: formattedContributors,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/contributors:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/contributors
 * Invite a new contributor by address (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminAddress, contributorAddress, contributorType } = body;

    if (!adminAddress || !contributorAddress || !contributorType) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: adminAddress, contributorAddress, contributorType' },
        { status: 400 }
      );
    }

    const validTypes = ['appointed', 'invited'];
    if (!validTypes.includes(contributorType)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Invalid contributor type. Must be one of: ${validTypes.join(', ')}` },
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

    // Check if user exists, if not create them
    let { data: contributor, error: contributorError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('address', contributorAddress.toLowerCase())
      .single();

    if (contributorError || !contributor) {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('chat_users')
        .insert({
          address: contributorAddress.toLowerCase(),
          display_name: `${contributorAddress.slice(0, 6)}...${contributorAddress.slice(-4)}`,
          role: 'contributor',
          contributor_type: contributorType,
          membership_tier: 'contributor',
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('Error creating contributor:', createError);
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Failed to create contributor' },
          { status: 500 }
        );
      }

      contributor = newUser;
    } else {
      // Update existing user to contributor
      const { data: updatedUser, error: updateError } = await supabase
        .from('chat_users')
        .update({
          role: 'contributor',
          contributor_type: contributorType,
        })
        .eq('id', contributor.id)
        .select()
        .single();

      if (updateError || !updatedUser) {
        console.error('Error updating contributor:', updateError);
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Failed to update contributor' },
          { status: 500 }
        );
      }

      contributor = updatedUser;
    }

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: {
        id: contributor.id,
        address: contributor.address,
        displayName: contributor.alias || contributor.display_name,
        role: contributor.role,
        contributorType: contributor.contributor_type,
      },
      message: 'Contributor invited successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/admin/contributors:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
