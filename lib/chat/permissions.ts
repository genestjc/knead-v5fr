/**
 * Temporary permissions stub - TO BE REPLACED with Towns TokenEntitlementModule
 * 
 * These functions are kept for backward compatibility with existing admin routes.
 * Future migration should use lib/towns/roles.ts for all permission checks.
 * 
 * See problem statement Phase 3 for proper Towns Space configuration:
 * - Participant Role: Premium NFT holders
 * - Contributor Role: Contributor NFT holders
 * - Admin Role: Owner NFT (automatic)
 */

import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isContributor as checkContributorNFT } from '@/lib/blockchain/contributor-nft';
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
 * Checks if a live event is currently active.
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
 * Determines if a user can post in a channel.
 * DEPRECATED: Use Towns Protocol's TokenEntitlementModule instead.
 * @param userId The user's ID from the users table.
 * @returns Promise<boolean>
 */
export async function canPostInChannel(userId: string): Promise<boolean> {
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
  // TODO: Replace with proper NFT check
  return false;
}

/**
 * Determines if a user can view a channel's content.
 * DEPRECATED: Use Towns Protocol's TokenEntitlementModule instead.
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
  if (!user.address) return false;

  // Check for contributor NFT
  const contributorCheck = await checkContributorNFT(user.address);
  return contributorCheck.isContributor;
}
