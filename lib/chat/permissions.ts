import type { ChatUser } from '@/types/chat';
import { createSupabaseAdmin, checkFreemiumTimeRemaining } from '@/lib/supabase/chat-client';

async function isLiveEventActive(): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin();
    const { count, error } = await supabase
      .from('chat_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'live');

    if (error) {
      console.error("Permissions Error: Could not check for active events.", error);
      return false;
    }
    return (count ?? 0) > 0;
  } catch (e) {
    console.error("Critical error in isLiveEventActive:", e);
    return false;
  }
}

// Exporting `canPostInChannel` as the build expects
export async function canPostInChannel(userId: string, channelId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data: user, error } = await supabase.from('chat_users').select('*').eq('id', userId).single();

  if (error || !user) {
    console.error("Permissions Error: Could not find user for canPostInChannel check", error);
    return false;
  }
  
  if (user.isBanned) return false;
  if (user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') return true;
  if (user.membershipTier === 'premium') {
    return await isLiveEventActive();
  }

  return false;
}

// Exporting `canViewChannel` as the build expects
export async function canViewChannel(userId: string, channelId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data: user, error } = await supabase.from('chat_users').select('*').eq('id', userId).single();
  
  if (error || !user) {
    console.error("Permissions Error: Could not find user for canViewChannel check", error);
    return false;
  }

  if (user.isBanned) return false;
  if (user.membershipTier === 'premium' || user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') return true;

  if (user.membershipTier === 'freemium') {
    const minutesLeft = await checkFreemiumTimeRemaining(user.id);
    return minutesLeft > 0;
  }

  return false;
}

// Exporting `getUserPermissions` as the build expects
export async function getUserPermissions(userId: string, channelId: string) {
    const canView = await canViewChannel(userId, channelId);
    const canPost = await canPostInChannel(userId, channelId);
    
    // As a safe default, only admins can delete/edit
    const supabase = createSupabaseAdmin();
    const { data: user } = await supabase.from('chat_users').select('role').eq('id', userId).single();
    const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';

    return {
        canView,
        canPost,
        canDelete: isAdmin,
        canEdit: isAdmin,
    };
}

export function canCreateDms(user: ChatUser): boolean {
    return user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin';
}

export function isAdmin(user: { role?: string }): boolean {
  return user.role === 'admin' || user.role === 'master-admin';
}
