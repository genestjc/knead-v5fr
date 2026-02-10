import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/permissions-override
 * 
 * Get all permission overrides
 * Requires: Contributor NFT (admin access)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    if (!adminAddress) {
      return NextResponse.json({ 
        error: 'Missing adminAddress parameter' 
      }, { status: 400 });
    }

    // Verify admin has contributor NFT
    const roleInfo = await getUserRole(adminAddress);
    if (roleInfo.role !== 'contributor') {
      return NextResponse.json({ 
        error: 'Forbidden: Only contributors can manage permissions' 
      }, { status: 403 });
    }

    // Get all permission overrides
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('permission_overrides')
      .select('*')
      .order('role', { ascending: true });

    if (error) {
      console.error('Error fetching permission overrides:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch permission overrides' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });

  } catch (error) {
    console.error('Error in GET /api/admin/permissions-override:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/permissions-override
 * 
 * Update a permission override
 * Requires: Contributor NFT (admin access)
 * 
 * Body: {
 *   role: 'freemium' | 'participant' | 'contributor',
 *   permissionType: 'canMessage' | 'canReact' | 'canDM',
 *   isEnabled: boolean
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    if (!adminAddress) {
      return NextResponse.json({ 
        error: 'Missing adminAddress parameter' 
      }, { status: 400 });
    }

    // Verify admin has contributor NFT
    const roleInfo = await getUserRole(adminAddress);
    if (roleInfo.role !== 'contributor') {
      return NextResponse.json({ 
        error: 'Forbidden: Only contributors can manage permissions' 
      }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { role, permissionType, isEnabled } = body;

    if (!role || !permissionType || isEnabled === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields: role, permissionType, isEnabled' 
      }, { status: 400 });
    }

    // Validate role
    if (!['freemium', 'participant', 'contributor'].includes(role)) {
      return NextResponse.json({ 
        error: 'Invalid role. Must be: freemium, participant, or contributor' 
      }, { status: 400 });
    }

    // Validate permission type
    if (!['canMessage', 'canReact', 'canDM'].includes(permissionType)) {
      return NextResponse.json({ 
        error: 'Invalid permissionType. Must be: canMessage, canReact, or canDM' 
      }, { status: 400 });
    }

    // Update permission override
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('permission_overrides')
      .upsert({
        role,
        permission_type: permissionType,
        is_enabled: isEnabled,
        updated_by: adminAddress.toLowerCase(),
      }, {
        onConflict: 'role,permission_type',
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating permission override:', error);
      return NextResponse.json({ 
        error: 'Failed to update permission override' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: `Permission override updated: ${role} - ${permissionType} = ${isEnabled}`,
    });

  } catch (error) {
    console.error('Error in POST /api/admin/permissions-override:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
