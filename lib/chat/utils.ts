/**
 * Chat Utility Functions
 * 
 * Shared utilities for chat-related operations
 */

import type { ChatUser } from '@/types/chat';

/**
 * Transform raw Supabase user data to ChatUser type
 * Centralizes the conversion logic to avoid duplication
 * 
 * @param user - Raw user data from Supabase
 * @returns ChatUser object
 */
export function transformToChatUser(user: any): ChatUser {
  return {
    id: user.id,
    address: user.address,
    displayName: user.display_name,
    avatar: user.avatar,
    role: user.role,
    membershipTier: user.membership_tier,
    contributorType: user.contributor_type,
    isBanned: user.is_banned,
    bio: user.bio,
    alias: user.alias,
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.updated_at),
  };
}
