import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

/**
 * Check if a user can access the DM feature
 * 
 * Rules:
 * - Master Admin: YES
 * - Contributors: YES
 * - Everyone else (Participants, Freemium): NO
 */
export async function canAccessDMs(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  
  const { data: user, error } = await supabase
    .from('chat_users')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return false;
  }

  // Master Admin or Contributors can access DMs
  return user.role === 'master-admin' || user.role === 'contributor';
}

/**
 * Check if a user can send a DM to another specific user
 * 
 * Rules:
 * - Master Admin can DM anyone
 * - Contributors can DM other Contributors or Master Admin
 * - Participants/Freemium cannot DM anyone
 */
export async function canDMUser(senderId: string, recipientId: string): Promise<{ allowed: boolean; reason?: string }> {
  const supabase = createSupabaseAdmin();
  
  // Get both users' roles
  const { data: users, error } = await supabase
    .from('chat_users')
    .select('id, role')
    .in('id', [senderId, recipientId]);

  if (error || !users || users.length !== 2) {
    return { allowed: false, reason: 'User not found' };
  }

  const sender = users.find(u => u.id === senderId);
  const recipient = users.find(u => u.id === recipientId);

  if (!sender || !recipient) {
    return { allowed: false, reason: 'User not found' };
  }

  // Master Admin can DM anyone (including Participants if needed)
  if (sender.role === 'master-admin') {
    return { allowed: true };
  }

  // Contributors can only DM other Contributors or Master Admin
  if (sender.role === 'contributor') {
    if (recipient.role === 'contributor' || recipient.role === 'master-admin') {
      return { allowed: true };
    }
    return { 
      allowed: false, 
      reason: 'Contributors can only DM other Contributors or admins.' 
    };
  }

  // Everyone else (Participants, Freemium) cannot DM
  return { 
    allowed: false, 
    reason: 'DMs are available to Contributors only. Focus on earning points to become a Contributor!' 
  };
}

/**
 * Get list of users a given user can DM
 */
export async function getDMEligibleUsers(userId: string) {
  const supabase = createSupabaseAdmin();
  
  // Get current user's role
  const { data: currentUser } = await supabase
    .from('chat_users')
    .select('role')
    .eq('id', userId)
    .single();

  if (!currentUser) {
    return [];
  }

  let query = supabase
    .from('chat_users')
    .select('id, display_name, alias, avatar, role')
    .neq('id', userId); // Exclude self

  if (currentUser.role === 'master-admin') {
    // Master Admin can DM anyone (but typically just Contributors)
    query = query.in('role', ['contributor', 'master-admin']);
  } else if (currentUser.role === 'contributor') {
    // Contributors can DM other Contributors and Master Admin
    query = query.in('role', ['contributor', 'master-admin']);
  } else {
    // Others can't DM anyone
    return [];
  }

  const { data: eligibleUsers, error } = await query;

  if (error) {
    console.error('Error fetching DM-eligible users:', error);
    return [];
  }

  return eligibleUsers || [];
}
