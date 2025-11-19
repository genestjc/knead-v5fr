/**
 * Point values, multipliers, and treasury configuration
 * Based on tokenomics_copilot_guide.md
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

export const TIER_THRESHOLDS = {
  1: { min: 0, max: 499 },
  2: { min: 500, max: 1499 },
  3: { min: 1500, max: 2999 },
  4: { min: 3000, max: 3333 },
  graduation: 3334,
} as const;

export const TREASURY_CONFIG = {
  // Conservative ratio for testing with 300 $TOWNS
  POINTS_PER_TOWNS: 100,  // 100 points = 1 $TOWNS
  
  // Testing thresholds (scaled down from production)
  GRADUATION_THRESHOLD_POINTS: 3334,
  GRADUATION_TOWNS_REWARD: 75,  // 75 $TOWNS instead of 75,000 for testing
  
  // Treasury health monitoring
  LOW_BALANCE_WARNING: 50,   // Alert when < 50 $TOWNS
  CRITICAL_BALANCE: 20,      // Stop withdrawals when < 20 $TOWNS
  
  // Contributor weekly budgets
  WEEKLY_BUDGETS: {
    appointed: 120,
    invited: 100,
    earned: 150,
  },
  
  // Rate limits
  MAX_POINTS_TO_SINGLE_PERSON: 30,
  COOLDOWN_HOURS: 2,
  MIN_UNIQUE_RECIPIENTS: 5,
} as const;

export const BONUS_POINTS = {
  guest_responds: 10,           // Admin/host replies to participant's question
  sparks_thread_5plus: 5,      // Original post gets 5+ replies
  gets_10plus_likes: 8,        // Message gets 10+ likes
  first_5_minutes_multiplier: 1.3,  // Posted in first 5 min of live event
} as const;

export type EventType = keyof typeof POINT_VALUES;
export type ActionType = keyof typeof POINT_VALUES.live_event;
export type ContributorType = keyof typeof CONTRIBUTOR_MULTIPLIERS;
export type TierLevel = keyof typeof TIER_MULTIPLIERS;
