import type { ChatUser, UserRole, MembershipTier } from '@/types/chat';
import { KNEAD_CHANNELS, TREASURY_CONFIG } from './config';

export function canSendMessage(
  user: ChatUser,
  channelId: string,
  isOpenPeriod: boolean = false
): boolean {
  if (user.isBanned) return false;
  const channel = KNEAD_CHANNELS.find(ch => ch.id === channelId);
  if (!channel) return false;
  if (user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
    return true;
  }
  if (user.membershipTier === 'premium' && isOpenPeriod) {
    return true;
  }
  if (channel.requiresContributor) {
    return user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin';
  }
  return false;
}

export function canViewChat(user: ChatUser, minutesUsed: number = 0): {
  canView: boolean;
  reason?: string;
} {
  if (user.isBanned) {
    return { canView: false, reason: 'User is banned' };
  }
  if (user.membershipTier === 'premium' || user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
    return { canView: true };
  }
  if (user.membershipTier === 'freemium') {
    if (minutesUsed >= 30) {
      return { canView: false, reason: 'Monthly viewing limit reached (30 minutes)' };
    }
    return { canView: true };
  }
  return { canView: false, reason: 'No membership found' };
}

export function canLikeMessage(user: ChatUser): boolean {
  if (user.isBanned) return false;
  return user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin';
}

export function shouldAutoGrantContributor(townsEarned: number): boolean {
  return townsEarned >= TREASURY_CONFIG.contributorThreshold;
}

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