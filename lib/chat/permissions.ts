import type { ChatUser, UserRole, MembershipTier, UserPermissions } from '@/types/chat';
import { KNEAD_CHANNELS, FREEMIUM_CONFIG } from './config';

/**
 * Check if user can view a specific channel
 * Respects freemium time limits
 */
export function canViewChannel(
  user: ChatUser,
  channelId: string,
  freemiumMinutesUsed: number = 0
): { canView: boolean; reason?: string } {
  if (user.isBanned) {
    return { canView: false, reason: 'User is banned' };
  }

  const channel = KNEAD_CHANNELS.find(ch => ch.id === channelId);
  if (!channel) {
    return { canView: false, reason: 'Channel not found' };
  }

  // Contributors and admins always have access
  if (user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
    return { canView: true };
  }

  // Premium members have full access
  if (user.membershipTier === 'premium') {
    return { canView: true };
  }

  // Freemium members have limited access
  if (user.membershipTier === 'freemium') {
    if (freemiumMinutesUsed >= FREEMIUM_CONFIG.maxMinutesPerMonth) {
      return { 
        canView: false, 
        reason: `Monthly viewing limit reached (${FREEMIUM_CONFIG.maxMinutesPerMonth} minutes)` 
      };
    }
    // Freemium can view but not contributor-only channels
    if (channel.requiresContributor) {
      return { canView: false, reason: 'This channel requires contributor access' };
    }
    return { canView: true };
  }

  return { canView: false, reason: 'No membership found' };
}

/**
 * Check if user can post in a specific channel
 * Freemium users are read-only
 */
export function canPostInChannel(
  user: ChatUser,
  channelId: string
): { canPost: boolean; reason?: string } {
  if (user.isBanned) {
    return { canPost: false, reason: 'User is banned' };
  }

  const channel = KNEAD_CHANNELS.find(ch => ch.id === channelId);
  if (!channel) {
    return { canPost: false, reason: 'Channel not found' };
  }

  // Contributors and admins can always post
  if (user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
    return { canPost: true };
  }

  // Freemium users are read-only
  if (user.membershipTier === 'freemium') {
    return { canPost: false, reason: 'Freemium users have read-only access. Upgrade to post messages.' };
  }

  // Premium members can post
  if (user.membershipTier === 'premium') {
    return { canPost: true };
  }

  return { canPost: false, reason: 'You need a membership to post messages' };
}

/**
 * Check if user can award likes
 * Contributors only
 */
export function canAwardLikes(user: ChatUser): { canAward: boolean; reason?: string } {
  if (user.isBanned) {
    return { canAward: false, reason: 'User is banned' };
  }

  if (user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
    return { canAward: true };
  }

  return { canAward: false, reason: 'Only contributors can award likes' };
}

/**
 * Check if user can receive likes
 * Paid participants and contributors only (freemium cannot receive)
 */
export function canReceiveLikes(user: ChatUser): { canReceive: boolean; reason?: string } {
  if (user.isBanned) {
    return { canReceive: false, reason: 'User is banned' };
  }

  // Contributors can receive
  if (user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
    return { canReceive: true };
  }

  // Premium members can receive
  if (user.membershipTier === 'premium') {
    return { canReceive: true };
  }

  // Freemium cannot receive points
  if (user.membershipTier === 'freemium') {
    return { canReceive: false, reason: 'Freemium users cannot receive points. Upgrade to premium.' };
  }

  return { canReceive: false, reason: 'You need a membership to receive points' };
}

/**
 * Get complete permissions object for a user
 */
export function getUserPermissions(
  user: ChatUser,
  channelId: string,
  freemiumMinutesUsed: number = 0,
  distributionBudget: number = 0,
  personalEarnings: number = 0,
  totalPoints: number = 0
): UserPermissions {
  const viewResult = canViewChannel(user, channelId, freemiumMinutesUsed);
  const postResult = canPostInChannel(user, channelId);
  const awardResult = canAwardLikes(user);
  const receiveResult = canReceiveLikes(user);

  const freemiumTimeRemaining = user.membershipTier === 'freemium'
    ? Math.max(0, FREEMIUM_CONFIG.maxMinutesPerMonth - freemiumMinutesUsed)
    : undefined;

  return {
    userId: user.id,
    role: user.role,
    contributorType: user.contributorType,
    canViewChannel: viewResult.canView,
    canPostInChannel: postResult.canPost,
    canAwardLikes: awardResult.canAward,
    canReceiveLikes: receiveResult.canReceive,
    distributionBudgetRemaining: distributionBudget,
    personalEarningsAvailable: personalEarnings,
    participantTier: user.role === 'viewer' ? getTierFromPoints(totalPoints) : undefined,
    totalPoints,
    freemiumTimeRemaining,
  };
}

// Helper functions
export function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getUserDisplayName(user: ChatUser): string {
  return user.alias || truncateAddress(user.address);
}

export function isAdmin(user: ChatUser): boolean {
  return user.role === 'admin' || user.role === 'master-admin';
}

export function isMasterAdmin(user: ChatUser): boolean {
  return user.role === 'master-admin';
}

export function isContributor(user: ChatUser): boolean {
  return user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin';
}

function getTierFromPoints(points: number): 1 | 2 | 3 | 4 {
  if (points >= 1000) return 4;
  if (points >= 500) return 3;
  if (points >= 100) return 2;
  return 1;
}