import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';
import { 
  grantTemporaryPermission, 
  revokeTemporaryPermission,
  getChannelTemporaryPermissions 
} from '@/lib/chat/check-temporary-permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/temporary-permissions
 * 
 * Get all active temporary permissions for a channel
 * Requires: Contributor NFT (admin access)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    const channelId = searchParams.get('channelId');

    if (!adminAddress) {
      return NextResponse.json({ 
        error: 'Missing adminAddress parameter' 
      }, { status: 400 });
    }

    if (!channelId) {
      return NextResponse.json({ 
        error: 'Missing channelId parameter' 
      }, { status: 400 });
    }

    // Verify admin has contributor NFT
    const roleInfo = await getUserRole(adminAddress);
    if (roleInfo.role !== 'contributor') {
      return NextResponse.json({ 
        error: 'Forbidden: Only contributors can view temporary permissions' 
      }, { status: 403 });
    }

    // Get temporary permissions
    const permissions = await getChannelTemporaryPermissions(channelId);

    return NextResponse.json({
      success: true,
      data: permissions,
    });

  } catch (error) {
    console.error('Error in GET /api/admin/temporary-permissions:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/temporary-permissions
 * 
 * Grant temporary permissions to wallet addresses
 * Requires: Contributor NFT (admin access)
 * 
 * Body: {
 *   walletAddresses: string[], // Array of wallet addresses
 *   channelId: string,
 *   permissionType: 'canMessage' | 'canReact' | 'canDM',
 *   expiresAt: string // ISO 8601 datetime
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
        error: 'Forbidden: Only contributors can grant temporary permissions' 
      }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { walletAddresses, channelId, permissionType, expiresAt } = body;

    if (!walletAddresses || !Array.isArray(walletAddresses) || walletAddresses.length === 0) {
      return NextResponse.json({ 
        error: 'walletAddresses must be a non-empty array' 
      }, { status: 400 });
    }

    if (!channelId || !permissionType || !expiresAt) {
      return NextResponse.json({ 
        error: 'Missing required fields: channelId, permissionType, expiresAt' 
      }, { status: 400 });
    }

    // Validate permission type
    if (!['canMessage', 'canReact', 'canDM'].includes(permissionType)) {
      return NextResponse.json({ 
        error: 'Invalid permissionType. Must be: canMessage, canReact, or canDM' 
      }, { status: 400 });
    }

    // Validate expiration date
    const expirationDate = new Date(expiresAt);
    if (isNaN(expirationDate.getTime())) {
      return NextResponse.json({ 
        error: 'Invalid expiresAt date format' 
      }, { status: 400 });
    }

    if (expirationDate <= new Date()) {
      return NextResponse.json({ 
        error: 'expiresAt must be in the future' 
      }, { status: 400 });
    }

    // Grant permissions to all wallet addresses
    const results = await Promise.all(
      walletAddresses.map(async (walletAddress) => {
        try {
          const success = await grantTemporaryPermission(
            walletAddress,
            channelId,
            permissionType,
            expirationDate,
            adminAddress
          );
          return { walletAddress, success };
        } catch (error) {
          console.error(`Error granting permission to ${walletAddress}:`, error);
          return { walletAddress, success: false };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failedAddresses = results.filter(r => !r.success).map(r => r.walletAddress);

    return NextResponse.json({
      success: true,
      message: `Granted temporary permissions to ${successCount} out of ${walletAddresses.length} addresses`,
      successCount,
      totalCount: walletAddresses.length,
      failedAddresses,
    });

  } catch (error) {
    console.error('Error in POST /api/admin/temporary-permissions:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/temporary-permissions
 * 
 * Revoke temporary permissions for wallet addresses
 * Requires: Contributor NFT (admin access)
 * 
 * Body: {
 *   walletAddress: string,
 *   channelId: string,
 *   permissionType: 'canMessage' | 'canReact' | 'canDM'
 * }
 */
export async function DELETE(req: NextRequest) {
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
        error: 'Forbidden: Only contributors can revoke temporary permissions' 
      }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { walletAddress, channelId, permissionType } = body;

    if (!walletAddress || !channelId || !permissionType) {
      return NextResponse.json({ 
        error: 'Missing required fields: walletAddress, channelId, permissionType' 
      }, { status: 400 });
    }

    // Revoke permission
    const success = await revokeTemporaryPermission(walletAddress, channelId, permissionType);

    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to revoke temporary permission' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Temporary permission revoked for ${walletAddress}`,
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/temporary-permissions:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
