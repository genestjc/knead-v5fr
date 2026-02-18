import { createClient } from '@supabase/supabase-js';
import type { ChatUser, UserPermissions, ActionType, EventType, ParticipantTier } from '@/types/chat';
import { getTierFromPoints } from '@/lib/chat/config';
import { getSupabaseAdmin } from './server';
import { logger } from '../logger';
import { formatAddressForDisplay } from '../utils/transformers';

// Admin client for server-side operations - use centralized singleton
export function createSupabaseAdmin() {
  return getSupabaseAdmin();
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
        displayName: existingUser.alias || formatAddressForDisplay(existingUser.address),
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
    const insertData: any = {
      address: address.toLowerCase(),
      role: 'viewer',
      membership_tier: 'freemium',
      is_banned: false,
    };
    
    if (avatar) {
      insertData.avatar = avatar;
    }
    
    const { data: newUser, error: createError } = await supabase
      .from('chat_users')
      .insert(insertData)
      .select()
      .single();

    if (createError || !newUser) {
      logger.error('Error creating chat user:', createError);
      return null;
    }

    return {
      id: newUser.id,
      address: newUser.address,
      displayName: formatAddressForDisplay(newUser.address),
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
    logger.error('Error in getOrCreateChatUser:', error);
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
      logger.error('Error checking user permissions:', error);
      return null;
    }

    return data as UserPermissions;
  } catch (error) {
    logger.error('Error in checkUserPermissions:', error);
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
    logger.error('Error starting freemium session:', error);
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
    logger.error('Error ending freemium session:', error);
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
      logger.error('Error checking freemium time:', error);
      return 60; // Default to full time remaining on error
    }

    const minutesUsed = data as number;
    return Math.max(0, 60 - minutesUsed);
  } catch (error) {
    logger.error('Error in checkFreemiumTimeRemaining:', error);
    return 60;
  }
}

/**
 * Record a like on a message (for UI only, no points awarded)
 * Points are now handled directly via blockchain transfers
 */
export async function recordLike(
  messageId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdmin();

  try {
    // Simply record the like in the database for UI display
    const { error } = await supabase
      .from('message_likes')
      .insert({
        message_id: messageId,
        user_id: userId,
        created_at: new Date().toISOString(),
      });

    if (error) {
      logger.error('Error recording like:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Error in recordLike:', error);
    return { success: false, error: error.message || 'Failed to record like' };
  }
}

/**
 * Remove a like from a message
 */
export async function removeLike(
  messageId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdmin();

  try {
    const { error } = await supabase
      .from('message_likes')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error removing like:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Error in removeLike:', error);
    return { success: false, error: error.message || 'Failed to remove like' };
  }
}
