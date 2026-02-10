// Chat-specific types for Towns Protocol integration

export type MembershipTier = 'freemium' | 'premium' | 'contributor';

export type UserRole = 'viewer' | 'contributor' | 'admin' | 'master-admin';

export type ContributorType = 'appointed' | 'invited' | 'earned';

export type ActionType = 
  | 'timely_question' 
  | 'substantive_comment' 
  | 'insightful_response' 
  | 'creative_contribution' 
  | 'helpful_clarification' 
  | 'thoughtful_followup';

export type EventType = 'live' | 'discussion' | 'essay';

export type AutomaticBonusType = 
  | 'guest_response' 
  | 'thread_starter' 
  | 'viral' 
  | 'attendance';

export type ParticipantTier = 1 | 2 | 3 | 4;

export interface ChatUser {
  id: string;
  address: string;
  displayName: string; // Truncated wallet or alias
  avatar?: string;
  role: UserRole;
  membershipTier: MembershipTier;
  contributorType?: ContributorType;
  isBanned: boolean;
  bio?: string; // For contributors
  alias?: string; // For contributors
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPermissions {
  canView: boolean;
  canPost: boolean;
  canDelete: boolean;
  canEdit: boolean;
  isBanned: boolean;
  membershipTier: MembershipTier;
  role: 'freemium' | 'participant' | 'contributor';
  contributorType?: ContributorType | null;
  freemiumMinutesUsed?: number;
  canDM?: boolean;
  isLiveEvent?: boolean;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: Date;
  replyToId?: string;
  replyToContent?: string;
  replyToUser?: string;
  likesCount: number;
  repliesCount: number;
  isDeleted: boolean;
  isHidden: boolean;
  moderationScore?: number;
  moderationCategories?: string[];
  user?: ChatUser;
}

export interface MessageLike {
  id: string;
  messageId: string;
  contributorId: string;
  participantId: string;
  actionType: ActionType;
  eventType: EventType;
  basePoints: number;
  contributorMultiplier: number;
  tierMultiplier: number;
  totalPoints: number;
  createdAt: Date;
  canUndo: boolean; // within 5 minutes
}

export interface AutomaticBonus {
  id: string;
  userId: string;
  bonusType: AutomaticBonusType;
  points: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface ChatEvent {
  id: string;
  title: string;
  description: string;
  channelId: string;
  eventType: EventType;
  hostId: string;
  guestIds: string[];
  scheduledStart: Date;
  scheduledEnd: Date;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  videoEnabled: boolean;
  dailyRoomUrl?: string;
  dailyRoomName?: string;
  createdAt: Date;
  host?: ChatUser;
}

export interface TownsClaimRequest {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'approved' | 'rejected';
  requestedAt: Date;
  processedAt?: Date;
  txHash?: string;
  notes?: string;
}

export interface ContributorUpgradeRequest {
  id: string;
  userId: string;
  currentRole: UserRole;
  requestedContributorType: ContributorType;
  reasoning: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

export interface ModerationResult {
  flagged: boolean;
  score: number;
  categories: {
    hate: number;
    harassment: number;
    selfHarm: number;
    sexual: number;
    violence: number;
  };
  message?: string;
}