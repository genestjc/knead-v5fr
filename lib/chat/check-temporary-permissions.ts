/**
 * Temporary Permissions System
 * 
 * Allows admins to grant temporary access to specific wallet addresses
 * for special events (e.g., graduate students for portfolio review)
 */

import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export type PermissionType = 'canMessage' | 'canReact' | 'canDM';

/**
 * Check if a wallet has temporary permission for a channel
 * 
 * @param walletAddress - User's wallet address
 * @param channelId - Channel ID
 * @param permissionType - Type of permission to check
 * @returns True if user has active temporary permission
 */
export async function hasTemporaryPermission(
  walletAddress: string,
  channelId: string,
  permissionType: PermissionType
): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('temporary_permissions')
      .select('id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('channel_id', channelId)
      .eq('permission_type', permissionType)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    if (error) {
      console.error('Error checking temporary permission:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error in hasTemporaryPermission:', error);
    return false;
  }
}

/**
 * Grant temporary permission to a wallet address
 * 
 * @param walletAddress - User's wallet address
 * @param channelId - Channel ID
 * @param permissionType - Type of permission to grant
 * @param expiresAt - When the permission expires
 * @param createdBy - Admin wallet address granting the permission
 * @returns True if permission was granted successfully
 */
export async function grantTemporaryPermission(
  walletAddress: string,
  channelId: string,
  permissionType: PermissionType,
  expiresAt: Date,
  createdBy: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin();
    
    const { error } = await supabase
      .from('temporary_permissions')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        channel_id: channelId,
        permission_type: permissionType,
        expires_at: expiresAt.toISOString(),
        created_by: createdBy.toLowerCase(),
      });

    if (error) {
      console.error('Error granting temporary permission:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in grantTemporaryPermission:', error);
    return false;
  }
}

/**
 * Revoke temporary permission for a wallet address
 * 
 * @param walletAddress - User's wallet address
 * @param channelId - Channel ID
 * @param permissionType - Type of permission to revoke
 * @returns True if permission was revoked successfully
 */
export async function revokeTemporaryPermission(
  walletAddress: string,
  channelId: string,
  permissionType: PermissionType
): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin();
    
    const { error } = await supabase
      .from('temporary_permissions')
      .delete()
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('channel_id', channelId)
      .eq('permission_type', permissionType);

    if (error) {
      console.error('Error revoking temporary permission:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in revokeTemporaryPermission:', error);
    return false;
  }
}

/**
 * Get all active temporary permissions for a channel
 * 
 * @param channelId - Channel ID
 * @returns Array of active temporary permissions
 */
export async function getChannelTemporaryPermissions(channelId: string) {
  try {
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('temporary_permissions')
      .select('*')
      .eq('channel_id', channelId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting channel temporary permissions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getChannelTemporaryPermissions:', error);
    return [];
  }
}

/**
 * Clean up expired temporary permissions
 * Calls the Supabase function to remove expired entries
 * 
 * @returns Number of permissions cleaned up
 */
export async function cleanupExpiredPermissions(): Promise<number> {
  try {
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase.rpc('cleanup_expired_temporary_permissions');

    if (error) {
      console.error('Error cleaning up expired permissions:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Error in cleanupExpiredPermissions:', error);
    return 0;
  }
}
