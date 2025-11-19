import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a participant can post in a channel
 * 
 * Rules:
 * - Contributors/Admins: Always allowed
 * - Freemium: Never allowed to post
 * - Premium Participants: Only during events they RSVP'd to (within time window)
 */
export async function canParticipantPost(
  userId: string,
  channelId: string
): Promise<PermissionResult> {
  const supabase = createSupabaseAdmin();
  
  // 1. Get user role and membership
  const { data: user, error: userError } = await supabase
    .from('chat_users')
    .select('role, membership_tier')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return { allowed: false, reason: 'User not found' };
  }

  // 2. Contributors and Admins: Always allowed
  if (['contributor', 'admin', 'master-admin', 'emergency-admin'].includes(user.role)) {
    return { allowed: true };
  }

  // 3. Freemium: Never allowed to post
  if (user.membership_tier === 'freemium') {
    return { 
      allowed: false, 
      reason: 'Upgrade to Premium to participate in events and post messages.' 
    };
  }

  // 4. Premium Participants: Only during events they RSVP'd to
  if (user.membership_tier === 'premium') {
    // Check for active event in this channel
    const { data: activeEvent, error: eventError } = await supabase
      .from('events')
      .select('id, start_time, end_time, participant_window_minutes')
      .eq('channel_id', channelId)
      .eq('status', 'active')
      .single();

    if (eventError || !activeEvent) {
      return { 
        allowed: false, 
        reason: 'No active event in this channel. Only Contributors can post outside events.' 
      };
    }

    // Check RSVP
    const { data: rsvp, error: rsvpError } = await supabase
      .from('rsvps')
      .select('status')
      .eq('event_id', activeEvent.id)
      .eq('participant_id', userId)
      .eq('status', 'confirmed')
      .single();

    if (rsvpError || !rsvp) {
      return { 
        allowed: false, 
        reason: 'You must RSVP to this event to participate. Check the Events tab.' 
      };
    }

    // Check if within participant time window
    const now = Date.now();
    const eventStart = new Date(activeEvent.start_time).getTime();
    const windowEnd = eventStart + (activeEvent.participant_window_minutes * 60 * 1000);

    if (now < eventStart) {
      const minutesUntilStart = Math.ceil((eventStart - now) / (1000 * 60));
      return { 
        allowed: false, 
        reason: `Event starts in ${minutesUntilStart} minutes.` 
      };
    }

    if (now > windowEnd) {
      // Check if user has extended access via tier
      const { data: participant } = await supabase
        .from('participants')
        .select('current_tier')
        .eq('user_id', userId)
        .single();

      const tierExtensions = {
        1: 0,           // Newcomer: no extension
        2: 30,          // Regular: +30 min
        3: 120,         // Veteran: +2 hours
        4: Infinity,    // Elite: full access (like Contributors)
      };

      const tier = (participant?.current_tier || 1) as 1 | 2 | 3 | 4;
      const extensionMinutes = tierExtensions[tier];
      const extendedEnd = windowEnd + (extensionMinutes * 60 * 1000);

      if (now > extendedEnd) {
        const nextTier = tier + 1;
        const nextTierName = ['', 'Newcomer', 'Regular', 'Veteran', 'Elite'][nextTier];
        return { 
          allowed: false, 
          reason: `Event participation window closed. ${nextTier <= 4 ? `Reach ${nextTierName} tier for extended access.` : 'Become a Contributor for full access.'}` 
        };
      }
    }

    return { allowed: true };
  }

  return { allowed: false, reason: 'Unauthorized' };
}

/**
 * Check if a user can read messages in a channel
 * 
 * Rules:
 * - Everyone can read (including Freemium)
 */
export async function canReadChannel(userId: string, channelId: string): Promise<PermissionResult> {
  const supabase = createSupabaseAdmin();
  
  const { data: user, error } = await supabase
    .from('chat_users')
    .select('id, is_banned')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return { allowed: false, reason: 'User not found' };
  }

  if (user.is_banned) {
    return { allowed: false, reason: 'You have been banned from the chat' };
  }

  return { allowed: true };
}

/**
 * Check if a user can react/like messages
 * 
 * Rules:
 * - Everyone can react (including Freemium)
 */
export async function canReactToMessage(userId: string): Promise<PermissionResult> {
  const supabase = createSupabaseAdmin();
  
  const { data: user, error } = await supabase
    .from('chat_users')
    .select('is_banned')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return { allowed: false, reason: 'User not found' };
  }

  if (user.is_banned) {
    return { allowed: false, reason: 'You have been banned' };
  }

  return { allowed: true };
}
