import { POINT_VALUES, CONTRIBUTOR_MULTIPLIERS, TIER_MULTIPLIERS, TREASURY_CONFIG } from './point-values';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { EventType, ActionType, ContributorType, TierLevel } from './point-values';

interface PointAwardParams {
  contributorId: string;
  participantId: string;
  actionType: ActionType;
  eventId: string;
  messageId?: string;
  bonusPoints?: number;
}

interface PointCalculationResult {
  participantReceives: number;
  contributorKeeps: number;
  basePoints: number;
  contributorMultiplier: number;
  tierMultiplier: number;
  bonusPoints: number;
  townsValue: {
    participant: number;
    contributor: number;
  };
}

/**
 * Calculate point distribution for a contributor award
 * 
 * Formula:
 * - Participant receives: (base × contributor_mult × tier_mult) + bonuses
 * - Contributor keeps: (base × contributor_mult) × 0.25
 */
export async function calculatePointAward(params: PointAwardParams): Promise<PointCalculationResult> {
  const { contributorId, participantId, actionType, eventId, messageId, bonusPoints = 0 } = params;
  const supabase = createSupabaseAdmin();

  // 1. Fetch contributor data
  const { data: contributor, error: contribError } = await supabase
    .from('chat_users')
    .select('id, contributor_type, remaining_weekly_budget, role')
    .eq('id', contributorId)
    .single();

  if (contribError || !contributor) {
    throw new Error('Contributor not found');
  }

  if (contributor.role !== 'contributor' && contributor.role !== 'admin' && contributor.role !== 'master-admin') {
    throw new Error('User is not a contributor');
  }

  // 2. Fetch participant data
  const { data: participant, error: partError } = await supabase
    .from('participants')
    .select('id, user_id, current_tier, total_points')
    .eq('user_id', participantId)
    .single();

  if (partError || !participant) {
    throw new Error('Participant not found');
  }

  // 3. Fetch event data
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, event_type, status')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    throw new Error('Event not found');
  }

  if (event.status !== 'active') {
    throw new Error('Cannot award points for inactive events');
  }

  // 4. Get multipliers and base points
  const contributorType = contributor.contributor_type as ContributorType;
  const tierLevel = participant.current_tier as TierLevel;
  
  if (!contributorType) {
    throw new Error('Contributor type not set');
  }

  const contributorMult = CONTRIBUTOR_MULTIPLIERS[contributorType];
  const tierMult = TIER_MULTIPLIERS[tierLevel];
  const eventType = event.event_type as EventType;
  const basePoints = POINT_VALUES[eventType][actionType];

  // 5. Calculate point distribution
  const participantReceives = (basePoints * contributorMult * tierMult) + bonusPoints;
  const contributorKeeps = (basePoints * contributorMult) * 0.25;

  // 6. Verify contributor has budget
  if (contributor.remaining_weekly_budget < basePoints) {
    throw new Error(
      `Insufficient weekly budget: ${contributor.remaining_weekly_budget} points remaining. ` +
      `Budget resets Monday 00:00 UTC.`
    );
  }

  // 7. Check rate limits
  await verifyRateLimits(contributorId, participantId);

  // 8. Execute atomic transaction
  const { error: transactionError } = await supabase.rpc('execute_point_award', {
    p_contributor_id: contributorId,
    p_participant_id: participant.id,
    p_event_id: eventId,
    p_message_id: messageId || null,
    p_action_type: actionType,
    p_base_points: basePoints,
    p_contributor_mult: contributorMult,
    p_tier_mult: tierMult,
    p_bonus_points: bonusPoints,
    p_participant_receives: participantReceives,
    p_contributor_keeps: contributorKeeps,
  });

  if (transactionError) {
    throw new Error(`Transaction failed: ${transactionError.message}`);
  }

  return {
    participantReceives,
    contributorKeeps,
    basePoints,
    contributorMultiplier: contributorMult,
    tierMultiplier: tierMult,
    bonusPoints,
    townsValue: {
      participant: participantReceives / TREASURY_CONFIG.POINTS_PER_TOWNS,
      contributor: contributorKeeps / TREASURY_CONFIG.POINTS_PER_TOWNS,
    },
  };
}

/**
 * Verify rate limits for point awards
 */
async function verifyRateLimits(contributorId: string, participantId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get all awards from this contributor in the past week
  const { data: weeklyAwards, error } = await supabase
    .from('point_transactions')
    .select('participant_id, base_points, created_at')
    .eq('contributor_id', contributorId)
    .gte('created_at', oneWeekAgo);

  if (error) {
    throw new Error(`Failed to check rate limits: ${error.message}`);
  }

  if (!weeklyAwards || weeklyAwards.length === 0) {
    return; // No previous awards, all checks pass
  }

  // Check 1: 2-hour cooldown to same participant
  const awardsToThisParticipant = weeklyAwards.filter(
    (award) => award.participant_id === participantId
  );

  if (awardsToThisParticipant.length > 0) {
    const lastAward = awardsToThisParticipant.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    const hoursSinceLastAward =
      (Date.now() - new Date(lastAward.created_at).getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastAward < TREASURY_CONFIG.COOLDOWN_HOURS) {
      const hoursRemaining = (TREASURY_CONFIG.COOLDOWN_HOURS - hoursSinceLastAward).toFixed(1);
      throw new Error(
        `Cooldown active: ${hoursRemaining} hours remaining before you can award this participant again.`
      );
    }
  }

  // Check 2: Max points to single participant per week
  const pointsToThisParticipant = awardsToThisParticipant.reduce(
    (sum, award) => sum + award.base_points,
    0
  );

  if (pointsToThisParticipant >= TREASURY_CONFIG.MAX_POINTS_TO_SINGLE_PERSON) {
    throw new Error(
      `Weekly limit reached: You've already awarded ${pointsToThisParticipant} points ` +
      `to this participant (max ${TREASURY_CONFIG.MAX_POINTS_TO_SINGLE_PERSON} per week).`
    );
  }

  // Check 3: Diversity requirement (5 unique recipients)
  const uniqueRecipients = new Set(weeklyAwards.map((award) => award.participant_id));

  if (
    weeklyAwards.length >= TREASURY_CONFIG.MIN_UNIQUE_RECIPIENTS &&
    uniqueRecipients.size < TREASURY_CONFIG.MIN_UNIQUE_RECIPIENTS
  ) {
    throw new Error(
      `Diversity requirement: You must award points to at least ` +
      `${TREASURY_CONFIG.MIN_UNIQUE_RECIPIENTS} different participants per week.`
    );
  }
}

/**
 * Get contributor's current point award statistics
 */
export async function getContributorStats(contributorId: string) {
  const supabase = createSupabaseAdmin();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: contributor } = await supabase
    .from('chat_users')
    .select('remaining_weekly_budget, personal_earnings_available, contributor_type')
    .eq('id', contributorId)
    .single();

  const { data: weeklyAwards } = await supabase
    .from('point_transactions')
    .select('participant_id, base_points, created_at')
    .eq('contributor_id', contributorId)
    .gte('created_at', oneWeekAgo);

  const uniqueRecipients = new Set(weeklyAwards?.map((a) => a.participant_id) || []);
  const totalAwarded = weeklyAwards?.reduce((sum, a) => sum + a.base_points, 0) || 0;

  return {
    remainingBudget: contributor?.remaining_weekly_budget || 0,
    personalEarnings: contributor?.personal_earnings_available || 0,
    weeklyAwardsCount: weeklyAwards?.length || 0,
    uniqueRecipientsCount: uniqueRecipients.size,
    totalPointsAwarded: totalAwarded,
    contributorType: contributor?.contributor_type,
  };
}
