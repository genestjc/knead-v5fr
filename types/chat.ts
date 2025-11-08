// Chat-specific types for Towns Protocol integration

export type MembershipTier = 'freemium' | 'premium' | 'contributor';

export type UserRole = 'viewer' | 'contributor' | 'admin' | 'master-admin';

export interface ChatUser {
  address: string;
  displayName: string; // Truncated wallet or alias
  avatar?: string;
  role: UserRole;
  membershipTier: MembershipTier;
  townsEarned: number;
  isBanned: boolean;
  bio?: string; // For contributors
  alias?: string; // For contributors
}

export interface ChatMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: Date;
  likes: number;
  likedBy: string[];
  isDeleted: boolean;
  user?: ChatUser;
}

export interface ChatChannel {
  id: string;
  name: string;
  icon: string;
  description: string;
  isOpenPeriod: boolean;
  requiresContributor: boolean;
}

export interface OpenPeriod {
  channelId: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
}

export interface FreemiumUsage {
  userId: string;
  monthlyMinutesUsed: number;
  lastReset: Date;
  maxMinutesPerMonth: number;
}

export interface TownsEarnings {
  userId: string;
  totalEarned: number;
  pendingTransfer: number;
  isContributor: boolean;
}