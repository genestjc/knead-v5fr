/**
 * Point values and multipliers for the Knead gamification system
 * Based on tokenomics guide - values differ by event type
 */

export const POINT_VALUES = {
  live_event: {
    timely_question: 8,
    substantive_comment: 6,
    threaded_reply: 5,
    insightful_reaction: 7,
    simple_like: 2,
    original_content: 10,
  },
  discussion_event: {
    timely_question: 5,
    substantive_comment: 8,
    threaded_reply: 7,
    insightful_reaction: 5,
    simple_like: 2,
    original_content: 12,
  },
  essay_event: {
    timely_question: 3,
    substantive_comment: 10,
    threaded_reply: 8,
    insightful_reaction: 4,
    simple_like: 2,
    original_content: 15,
  },
} as const;

export const CONTRIBUTOR_MULTIPLIERS = {
  appointed: 0.8,
  invited: 1.0,
  earned: 1.5,
} as const;

export const TIER_MULTIPLIERS = {
  1: 1.0,   // Newcomer (0-499 points)
  2: 1.1,   // Regular (500-1,499 points)
  3: 1.2,   // Veteran (1,500-2,999 points)
  4: 1.25,  // Elite (3,000-3,333 points)
} as const;

export const TREASURY_CONFIG = {
  // Conservative conversion for testing: 100 points = 1 $TOWNS
  POINTS_PER_TOWNS: 100,
  
  // Graduation threshold (Participant becomes Earned Contributor)
  GRADUATION_THRESHOLD_POINTS: 3334,
  
  // Reward when graduating (scaled down for testing)
  GRADUATION_TOWNS_REWARD: 75, // 75 $TOWNS for testing (normally 75,000)
  
  // Treasury health alerts
  LOW_BALANCE_WARNING: 50,
  CRITICAL_BALANCE: 20,
  
  // Weekly budget by contributor type
  WEEKLY_BUDGETS: {
    appointed: 120,
    invited: 100,
    earned: 150,
  },
} as const;

export const BONUS_POINTS = {
  guest_responds: 10,
  thread_starter_10_replies: 5,
  thread_starter_20_replies: 8,
  gets_10_likes: 8,
  first_5_minutes: 1.3, // multiplier
} as const;

export type EventType = keyof typeof POINT_VALUES;
export type ActionType = keyof typeof POINT_VALUES.live_event;
export type ContributorType = keyof typeof CONTRIBUTOR_MULTIPLIERS;
export type ParticipantTier = keyof typeof TIER_MULTIPLIERS;