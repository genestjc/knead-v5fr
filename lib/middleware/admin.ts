import { getSupabaseAdmin } from '@/lib/supabase/server';
import { transformDbUserToChatUser } from '@/lib/utils/transformers';
import { isAdmin } from '@/lib/chat/permissions';
import type { ChatUser } from '@/types/chat';

/**
 * Verify admin permissions for a user
 * Centralizes admin verification logic used across 8+ API routes
 * 
 * @param adminId - User ID to verify
 * @returns Object with user (if admin) or error message
 */
export async function verifyAdmin(adminId: string): Promise<{ user: ChatUser | null; error: string | null }> {
  const supabase = getSupabaseAdmin();
  
  const { data: user, error } = await supabase
    .from('chat_users')
    .select('*')
    .eq('id', adminId)
    .single();
    
  if (error || !user) {
    return { user: null, error: 'User not found' };
  }
  
  const chatUser = transformDbUserToChatUser(user);
  
  if (!isAdmin(chatUser)) {
    return { user: null, error: 'Insufficient permissions' };
  }
  
  return { user: chatUser, error: null };
}

/**
 * Verify admin permissions by wallet address
 * Alternative verification method for routes that use address instead of ID
 * 
 * @param adminAddress - Wallet address to verify
 * @returns Object with user (if admin) or error message
 */
export async function verifyAdminByAddress(adminAddress: string): Promise<{ user: ChatUser | null; error: string | null }> {
  const supabase = getSupabaseAdmin();
  
  const { data: user, error } = await supabase
    .from('chat_users')
    .select('*')
    .eq('address', adminAddress.toLowerCase())
    .single();
    
  if (error || !user) {
    return { user: null, error: 'User not found' };
  }
  
  const chatUser = transformDbUserToChatUser(user);
  
  if (!isAdmin(chatUser)) {
    return { user: null, error: 'Insufficient permissions' };
  }
  
  return { user: chatUser, error: null };
}
