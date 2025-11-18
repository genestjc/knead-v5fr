import { createClient } from '@supabase/supabase-js';
import type { ChatUser, UserPermissions, ActionType, EventType, ParticipantTier } from '@/types/chat';
import { getTierFromPoints } from '@/lib/chat/config';

// Admin client for server-side operations
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Client-side Supabase client
export function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Get or create a chat user (idempotent)
 */
export async function getOrCreateChatUser(
  address: string,
  displayName?: string,
  avatar?: string
): Promise<ChatUser | null> {
  const supabase = createSupabaseAdmin();

  try {
    // Try to get existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('address', address.toLowerCase())
      .single();

    if (existingUser && !fetchError) {
      return {
        id: existingUser.id,
        address: existingUser.address,
        displayName: existingUser.display_name,
        avatar: existingUser.avatar,
        role: existingUser.role,
        membershipTier: existingUser.membership_tier,
        contributorType: existingUser.contributor_type,
        isBanned: existingUser.is_banned,
        bio: existingUser.bio,
        alias: existingUser.alias,
        createdAt: new Date(existingUser.created_at),
        updatedAt: new Date(existingUser.updated_at),
      };
    }

    // Create new user
    const { data: newUser, error: createError } = await supabase
      .from('chat_users')
      .insert({
        address: address.toLowerCase(),
        display_name: displayName || address.slice(0, 6) + '...' + address.slice(-4),
        avatar: avatar,
        role: 'viewer',
        membership_tier: 'freemium',
        is_banned: false,
      })
      .select()
      .single();

    if (createError || !newUser) {
      console.error('Error creating chat user:', createError);
      return null;
    }

    return {
      id: newUser.id,
      address: newUser.address,
      displayName: newUser.display_name,
      avatar: newUser.avatar,
      role: newUser.role,
      membershipTier: newUser.membership_tier,
      contributorType: newUser.contributor_type,
      isBanned: newUser.is_banned,
      bio: newUser.bio,
      alias: newUser.alias,
      createdAt: new Date(newUser.created_at),
      updatedAt: new Date(newUser.updated_at),
    };
  } catch (error) {
    console.error('Error in getOrCreateChatUser:', error);
    return null;
  }
}

/**
 * Check user permissions - returns full permission object
 */
export async function checkUserPermissions(
  userId: string,
  channelId: string
): Promise<UserPermissions | null> {
  const supabase = createSupabaseAdmin();

  try {
    const { data, error } = await supabase.rpc('get_user_permissions', {
      p_user_id: userId,
      p_channel_id: channelId,
    });

    if (error || !data) {
      console.error('Error checking user permissions:', error);
      return null;
    }

    return data as UserPermissions;
  } catch (error) {
    console.error('Error in checkUserPermissions:', error);
    return null;
  }
}

/**
 * Start freemium session - track time for 1 hour/month limit
 */
export async function startFreemiumSession(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();

  try {
    const { error } = await supabase.from('freemium_sessions').insert({
      user_id: userId,
      started_at: new Date().toISOString(),
    });

    return !error;
  } catch (error) {
    console.error('Error starting freemium session:', error);
    return false;
  }
}

/**
 * End freemium session - update duration
 */
export async function endFreemiumSession(sessionId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();

  try {
    const { error } = await supabase
      .from('freemium_sessions')
      .update({
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .is('ended_at', null);

    return !error;
  } catch (error) {
    console.error('Error ending freemium session:', error);
    return false;
  }
}

/**
 * Check freemium time remaining (1 hour/month limit)
 */
export async function checkFreemiumTimeRemaining(userId: string): Promise<number> {
  const supabase = createSupabaseAdmin();

  try {
    const { data, error } = await supabase.rpc('get_freemium_time_used', {
      p_user_id: userId,
    });

    if (error || data === null) {
      console.error('Error checking freemium time:', error);
      return 60; // Default to full time remaining on error
    }

    const minutesUsed = data as number;
    return Math.max(0, 60 - minutesUsed);
  } catch (error) {
    console.error('Error in checkFreemiumTimeRemaining:', error);
    return 60;
  }
}

/**
 * Award like - Contributor awards points to participant
 */
export async function awardLike(
  messageId: string,
  contributorId: string,
  actionType: ActionType,
  eventType: EventType
): Promise<{ success: boolean; points?: number; budgetRemaining?: number; error?: string }> {
  const supabase = createSupabaseAdmin();

  try {
    const { data, error } = await supabase.rpc('award_like', {
      p_message_id: messageId,
      p_contributor_id: contributorId,
      p_action_type: actionType,
      p_event_type: eventType,
    });

    if (error) {
      console.error('Error awarding like:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      points: data?.points_awarded,
      budgetRemaining: data?.budget_remaining,
    };
  } catch (error: any) {
    console.error('Error in awardLike:', error);
    return { success: false, error: error.message || 'Failed to award like' };
  }
}

/**
 * Unlike message - Reverse like within 5 minutes
 */
export async function unlikeMessage(
  messageId: string,
  contributorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdmin();

  try {
    const { data, error } = await supabase.rpc('unlike_message', {
      p_message_id: messageId,
      p_contributor_id: contributorId,
    });

    if (error) {
      console.error('Error unliking message:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in unlikeMessage:', error);
    return { success: false, error: error.message || 'Failed to unlike message' };
  }
}

/**
 * Award automatic bonus - System-triggered bonuses
 */
export async function awardAutomaticBonus(
  userId: string,
  bonusType: 'guest_response' | 'thread_starter' | 'viral' | 'attendance',
  metadata: Record<string, any> = {}
): Promise<{ success: boolean; points?: number; error?: string }> {
  const supabase = createSupabaseAdmin();

  try {
    const { data, error } = await supabase.rpc('award_automatic_bonus', {
      p_user_id: userId,
      p_bonus_type: bonusType,
      p_metadata: metadata,
    });

    if (error) {
      console.error('Error awarding automatic bonus:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      points: data?.points_awarded,
    };
  } catch (error: any) {
    console.error('Error in awardAutomaticBonus:', error);
    return { success: false, error: error.message || 'Failed to award bonus' };
  }
}

/**
 * Get contributor stats - Analytics for contributor dashboard
 */
export async function getContributorStats(contributorId: string): Promise<{
  totalLikesAwarded: number;
  totalPointsDistributed: number;
  budgetRemaining: number;
  topRecipients: Array<{ userId: string; displayName: string; points: number }>;
} | null> {
  const supabase = createSupabaseAdmin();

  try {
    const { data, error } = await supabase.rpc('get_contributor_stats', {
      p_contributor_id: contributorId,
    });

    if (error || !data) {
      console.error('Error getting contributor stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getContributorStats:', error);
    return null;
  }
}
