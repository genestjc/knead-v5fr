import type { ChatUser } from '@/types/chat';

/**
 * Transform database user object to ChatUser type
 * Centralizes user transformation logic to ensure consistency
 * Used across 10+ API routes
 */
export function transformDbUserToChatUser(dbUser: any): ChatUser {
  const address = dbUser.address;
  
  return {
    id: dbUser.id,
    address: address,
    displayName: dbUser.alias || `${address.slice(0, 6)}...${address.slice(-4)}`,
    avatar: dbUser.avatar,
    role: dbUser.role,
    membershipTier: dbUser.membership_tier,
    contributorType: dbUser.contributor_type,
    isBanned: dbUser.is_banned,
    bio: dbUser.bio,
    alias: dbUser.alias,
    createdAt: new Date(dbUser.created_at),
    updatedAt: new Date(dbUser.updated_at),
  };
}
