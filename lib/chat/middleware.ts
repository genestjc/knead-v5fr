/**
 * Chat Middleware Functions
 * 
 * Shared middleware for permission verification and common checks
 */

import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { isAdmin } from './permissions';
import { transformToChatUser } from './utils';
import type { ChatUser } from '@/types/chat';

/**
 * Verify admin permissions for a given address
 * Centralizes admin verification logic to avoid duplication
 * 
 * @param adminAddress - Wallet address to verify
 * @returns Object with success status, user data (if successful), and error message (if failed)
 */
export async function verifyAdminPermissions(
  adminAddress: string
): Promise<{ success: boolean; user?: ChatUser; error?: string }> {
  const supabase = createSupabaseAdmin();
  
  const { data: user, error } = await supabase
    .from('chat_users')
    .select('*')
    .eq('address', adminAddress.toLowerCase())
    .single();

  if (error || !user) {
    return { success: false, error: 'User not found' };
  }

  const chatUser = transformToChatUser(user);
  
  if (!isAdmin(chatUser)) {
    return { success: false, error: 'Insufficient permissions' };
  }

  return { success: true, user: chatUser };
}

/**
 * Verify admin permissions by user ID (alternative method)
 * 
 * @param adminId - User ID to verify
 * @returns Object with success status, user data (if successful), and error message (if failed)
 */
export async function verifyAdminPermissionsById(
  adminId: string
): Promise<{ success: boolean; user?: ChatUser; error?: string }> {
  const supabase = createSupabaseAdmin();
  
  const { data: user, error } = await supabase
    .from('chat_users')
    .select('*')
    .eq('id', adminId)
    .single();

  if (error || !user) {
    return { success: false, error: 'User not found' };
  }

  const chatUser = transformToChatUser(user);
  
  if (!isAdmin(chatUser)) {
    return { success: false, error: 'Insufficient permissions' };
  }

  return { success: true, user: chatUser };
}
