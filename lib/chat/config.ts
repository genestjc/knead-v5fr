import type { ChatChannel, ActionType, EventType, ContributorType, ParticipantTier } from '@/types/chat';

// Knead chat channels configuration
export const KNEAD_CHANNELS: ChatChannel[] = [
  {
    id: 'general',
    name: 'General',
    icon: '💬',
    description: 'General discussion for all topics',
    isOpenPeriod: false,
    requiresContributor: false,
  },
  {
    id: 'live-interviews',
    name: 'Live Interviews',
    icon: '🎙️',
    description: 'Voice and video interviews with contributors',
    isOpenPeriod: false,
    requiresContributor: true,
  },
  {
    id: 'essay-discussion',
    name: 'Essay Discussion',
    icon: '📝',
    description: 'Deep discussions on essays and articles',
    isOpenPeriod: false,
    requiresContributor: false,
  },
  {
    id: 'contributors',
    name: 'Contributors',
    icon: '⭐',
    description: 'Private channel for contributors only',
    isOpenPeriod: false,
    requiresContributor: true,
  },
];

// Point values matrix: [action_type][event_type]
export const POINT_VALUES: Record<ActionType, Record<EventType, number>> = {
  timely_question: {
    live: 5,
    discussion: 3,
    essay: 2,
  },
  substantive_comment: {
    live: 7,
    discussion: 5,
    essay: 4,
  },
  insightful_response: {
    live: 10,
    discussion: 7,
    essay: 5,
  },
  creative_contribution: {
    live: 8,
    discussion: 6,
    essay: 5,
  },
  helpful_clarification: {
    live: 6,
    discussion: 4,
    essay: 3,
  },
  thoughtful_followup: {
    live: 4,
    discussion: 3,
    essay: 2,
  },
};

// Contributor multipliers
export const CONTRIBUTOR_MULTIPLIERS: Record<ContributorType, number> = {
  appointed: 0.8,
  invited: 1.0,
  earned: 1.5,
};

// Participant tier multipliers
export const TIER_MULTIPLIERS: Record<ParticipantTier, number> = {
  1: 1.0,
  2: 1.1,
  3: 1.15,
  4: 1.25,
};

// Tier thresholds (points needed to reach each tier)
export const TIER_THRESHOLDS: Record<ParticipantTier, number> = {
  1: 0,
  2: 100,
  3: 500,
  4: 1000,
};

// Automatic bonus values
export const AUTOMATIC_BONUSES = {
  guest_response: 20, // Admin replies to participant
  thread_starter: 15, // Message gets 10+ replies
  viral: 25, // Message gets 20+ likes
  attendance: 10, // Attended live event
};

// Rate limits and cooldowns
export const RATE_LIMITS = {
  messageCooldown: 2000, // 2 seconds between messages
  likeCooldown: 1000, // 1 second between likes
  maxMessagesPerHour: 100,
  maxLikesPerHour: 50,
  unlikeWindow: 300000, // 5 minutes in milliseconds
};

// Freemium configuration
export const FREEMIUM_CONFIG = {
  maxMinutesPerMonth: 60, // 1 hour per month
  warningThreshold: 50, // Warn at 50 minutes
};

// Contributor daily budget
export const CONTRIBUTOR_BUDGET = {
  dailyDistributionPoints: 100,
  resetHour: 0, // Midnight UTC
};

// Moderation thresholds
export const MODERATION_THRESHOLDS = {
  autoFlag: 0.8, // Auto-flag if any category exceeds this
  autoReject: 0.9, // Auto-reject if any category exceeds this
};

// Helper functions
export function getBasePoints(actionType: ActionType, eventType: EventType): number {
  return POINT_VALUES[actionType]?.[eventType] || 0;
}

export function getContributorMultiplier(contributorType: ContributorType): number {
  return CONTRIBUTOR_MULTIPLIERS[contributorType] || 1.0;
}

export function getTierMultiplier(tier: ParticipantTier): number {
  return TIER_MULTIPLIERS[tier] || 1.0;
}

export function getTierFromPoints(points: number): ParticipantTier {
  if (points >= TIER_THRESHOLDS[4]) return 4;
  if (points >= TIER_THRESHOLDS[3]) return 3;
  if (points >= TIER_THRESHOLDS[2]) return 2;
  return 1;
}

export function calculateParticipantPoints(
  actionType: ActionType,
  eventType: EventType,
  contributorType: ContributorType,
  participantTier: ParticipantTier
): number {
  const basePoints = getBasePoints(actionType, eventType);
  const contributorMultiplier = getContributorMultiplier(contributorType);
  const tierMultiplier = getTierMultiplier(participantTier);
  
  return Math.round(basePoints * contributorMultiplier * tierMultiplier);
}

export const TREASURY_CONFIG = {
  tokensPerLike: 1,
  contributorThreshold: 1000,
  maxLikesPerUser: 50,
};