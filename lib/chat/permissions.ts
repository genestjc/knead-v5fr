/**
 * Enhanced Permissions System
 * 
 * Implements NFT-based permissions with event-based messaging and admin controls:
 * - Contributors: Full access always
 * - Participants: Can post only during live events (or with admin override)
 * - Freemium: Cannot post (unless admin override for broadcasts)
 * 
 * Supports:
 * - Event-based messaging for Participants
 * - Admin permission overrides
 * - Temporary permissions for special events
 */

import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isContributor as checkContributorNFT } from '@/lib/blockchain/contributor-nft';
import { getUserRole, type UserRole } from '@/lib/blockchain/check-nft-ownership';
import { hasTemporaryPermission, type PermissionType } from './check-temporary-permissions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

/**
 * Simple helper to check for admin roles from a user object.
 * @param user - A user object with a `role` property.
 */
export function isAdmin(user: { role?: string }): boolean {
  return user?.role === 'admin' || user?.role === 'master-admin';
}

/**
 * Check if a live event is currently active for a specific channel
 * 
 * @param channelId - Channel ID to check
 * @returns True if a live event is active
 */
export async function checkLiveEvent(channelId: string): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin();
    const { data: events, error } = await supabase
      .from('chat_events')
      .select('id')
      .eq('channel_id', channelId)
      .eq('status', 'live')
      .limit(1);

    if (error) {
      logger.error("Error checking live event:", error);
      return false;
    }

    return events && events.length > 0;
  } catch (error) {
    logger.error("Exception in checkLiveEvent:", error);
    return false;
  }
}

/**
 * Check if there's an admin permission override for a role
 * 
 * @param role - User role
 * @param permissionType - Type of permission
 * @returns True if override is enabled
 */
export async function checkPermissionOverride(
  role: UserRole,
  permissionType: PermissionType
): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('permission_overrides')
      .select('is_enabled')
      .eq('role', role)
      .eq('permission_type', permissionType)
      .single();

    if (error) {
      // If no override exists, return false
      return false;
    }

    return data?.is_enabled || false;
  } catch (error) {
    logger.error("Error checking permission override:", error);
    return false;
  }
}

/**
 * Checks if a live event is currently active (legacy function for compatibility)
 * @param supabase - An active Supabase client instance.
 * @returns Promise<boolean>
 */
async function isLiveEventActive(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from('chat_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'live');
  if (error) {
    logger.error("Permissions Error: Could not check for active events.", error);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * Determines if a user can post in a channel (new implementation with event-based messaging)
 * 
 * @param userAddress - User's wallet address
 * @param channelId - Channel ID (defaults to 'live-interviews')
 * @returns True if user can post
 */
export async function canPostInChannel(
  userAddress: string, 
  channelId: string = 'live-interviews'
): Promise<boolean> {
  try {
    if (!userAddress) return false;

    // Get user's role from NFT ownership
    const roleInfo = await getUserRole(userAddress);

    // Check for admin permission override first
    const hasOverride = await checkPermissionOverride(roleInfo.role, 'canMessage');
    if (hasOverride) {
      return true;
    }

    // Check for temporary permissions
    const hasTempPermission = await hasTemporaryPermission(userAddress, channelId, 'canMessage');
    if (hasTempPermission) {
      return true;
    }

    // Contributors can always post
    if (roleInfo.role === 'contributor') {
      return true;
    }

    // Freemium cannot post (unless override is enabled)
    if (roleInfo.role === 'freemium') {
      return false;
    }

    // Participants can only post during live events
    if (roleInfo.role === 'participant') {
      const isLiveEvent = await checkLiveEvent(channelId);
      return isLiveEvent;
    }

    return false;
  } catch (error) {
    logger.error("Error in canPostInChannel:", error);
    return false;
  }
}

/**
 * Legacy function - determines if a user can post based on user ID
 * DEPRECATED: Use canPostInChannel(userAddress, channelId) instead
 * 
 * @param userId The user's ID from the users table.
 * @returns Promise<boolean>
 */
export async function canPostInChannelLegacy(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data: user, error } = await supabase
    .from('chat_users')
    .select('id, address, role, is_banned')
    .eq('id', userId)
    .single();

  if (error || !user || user.is_banned) return false;
  if (!user.address) return false;
  
  if (isAdmin(user)) return true;

  // Check for contributor NFT
  const contributorCheck = await checkContributorNFT(user.address);
  if (contributorCheck.isContributor) return true;
  
  // Check for premium membership during live events
  const hasLiveEvent = await isLiveEventActive(supabase);
  if (hasLiveEvent) {
    const roleInfo = await getUserRole(user.address);
    return roleInfo.role === 'participant';
  }

  return false;
}

/**
 * Determines if a user can view a channel's content.
 * All users can view (freemium has time limit enforced separately)
 * 
 * @param userId The user's ID from the users table.
 * @returns Promise<boolean>
 */
export async function canViewChannel(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data: user, error } = await supabase
    .from('chat_users')
    .select('id, address, is_banned')
    .eq('id', userId)
    .single();

  if (error || !user || user.is_banned) return false;
  
  // All users can view (freemium time limit is enforced via timer)
  return true;
}

/**
 * Determines if a user can create DMs (Contributors only)
 * 
 * @param userAddress - User's wallet address
 * @returns True if user can create DMs
 */
export async function canCreateDM(userAddress: string): Promise<boolean> {
  try {
    if (!userAddress) return false;

    // Check for admin permission override
    const roleInfo = await getUserRole(userAddress);
    const hasOverride = await checkPermissionOverride(roleInfo.role, 'canDM');
    
    // If override exists, respect it (can be used to disable DMs during lockdown)
    if (hasOverride !== undefined) {
      return hasOverride;
    }

    // Only contributors can create DMs
    return roleInfo.role === 'contributor';
  } catch (error) {
    logger.error("Error in canCreateDM:", error);
    return false;
  }
}

