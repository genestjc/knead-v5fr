import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isAdmin } from '@/lib/chat/permissions';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/contributor-requests
 * List all pending contributor upgrade requests (admin only)
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

    // Fetch all pending requests
    const { data: requests, error } = await supabase
      .from('contributor_upgrade_requests')
      .select(`
        *,
        chat_users!user_id (
          id,
          address,
          display_name,
          alias,
          role,
          membership_tier
        )
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Error fetching contributor requests:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch contributor requests' },
        { status: 500 }
      );
    }

    const formattedRequests = requests.map((req) => ({
      id: req.id,
      userId: req.user_id,
      currentRole: req.current_role,
      requestedContributorType: req.requested_contributor_type,
      reasoning: req.reasoning,
      status: req.status,
      requestedAt: new Date(req.requested_at),
      user: {
        id: req.chat_users.id,
        address: req.chat_users.address,
        displayName: req.chat_users.alias || req.chat_users.display_name,
        role: req.chat_users.role,
        membershipTier: req.chat_users.membership_tier,
      },
    }));

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: formattedRequests,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/contributor-requests:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/contributor-requests
 * User submits a request to become a contributor
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, requestedContributorType, reasoning } = body;

    if (!userId || !requestedContributorType || !reasoning) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: userId, requestedContributorType, reasoning' },
        { status: 400 }
      );
    }

    const validTypes = ['appointed', 'invited', 'earned'];
    if (!validTypes.includes(requestedContributorType)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Invalid contributor type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Get user's current role
    const { data: user, error: userError } = await supabase
      .from('chat_users')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user already has a pending request
    const { data: existingRequest } = await supabase
      .from('contributor_upgrade_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'You already have a pending contributor request' },
        { status: 400 }
      );
    }

    // Create request
    const { data: request, error: insertError } = await supabase
      .from('contributor_upgrade_requests')
      .insert({
        user_id: userId,
        current_role: user.role,
        requested_contributor_type: requestedContributorType,
        reasoning: reasoning,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !request) {
      console.error('Error creating contributor request:', insertError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to create contributor request' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: {
        id: request.id,
        userId: request.user_id,
        currentRole: request.current_role,
        requestedContributorType: request.requested_contributor_type,
        reasoning: request.reasoning,
        status: request.status,
        requestedAt: new Date(request.requested_at),
      },
      message: 'Contributor request submitted successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/admin/contributor-requests:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
