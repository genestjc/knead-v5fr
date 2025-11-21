import type { ChatUser } from '@/types/chat';
import { createSupabaseAdmin, checkFreemiumTimeRemaining } from '@/lib/supabase/chat-client';

/**
 * Checks if a live event is currently active.
 * This is the trigger that "opens" the chat for Paid Participants.
 * It queries the `chat_events` table, which is managed by your EventsManager.
 * 
 * @returns {Promise<boolean>} - True if at least one event is 'live', false otherwise.
 */
async function isLiveEventActive(): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { count, error } = await supabase
    .from('chat_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'live');

  if (error) {
    console.error("Permissions Error: Could not check for active events.", error);
    return false; // Fail-safe: if the database query fails, the chat remains closed to participants.
  }
  return (count ?? 0) > 0;
}

/**
 * Determines if a user can POST a message.
 * This is the central logic for enforcing your chat rules.
 */
export async function canPostMessage(user: ChatUser): Promise<{ canPost: boolean; reason: string }> {
  // Rule 1: Banned users can never post.
  if (user.isBanned) {
    return { canPost: false, reason: 'Your account is suspended.' };
  }

  // Rule 2: Contributors and Admins have unrestricted posting access.
  if (user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
    return { canPost: true, reason: 'Full access granted.' };
  }

  // Rule 3: Paid Participants ('premium') can post ONLY during live events.
  if (user.membershipTier === 'premium') {
    if (await isLiveEventActive()) {
      return { canPost: true, reason: 'A live event is active. Welcome!' };
    } else {
      return { canPost: false, reason: 'The chat is open for posting during live events only.' };
    }
  }

  // Rule 4: Freemium users and all others cannot post.
  return { canPost: false, reason: 'Posting is available for paid members during events and for contributors at all times.' };
}

/**
 * Determines if a user can VIEW the chat.
 * Enforces the 1-hour (60-minute) limit for freemium users.
 */
export async function canViewChat(user: ChatUser): Promise<{ canView: boolean; reason: string }> {
    // Rule 1: Banned users can never view.
    if (user.isBanned) {
        return { canView: false, reason: 'Your account is suspended.' };
    }

    // Rule 2: Paid members, Contributors, and Admins can always view.
    if (user.membershipTier === 'premium' || user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
        return { canView: true, reason: 'Full viewing access.' };
    }

    // Rule 3: Freemium users are on a time limit.
    if (user.membershipTier === 'freemium') {
        // This function is assumed to exist in your Supabase client library
        const minutesLeft = await checkFreemiumTimeRemaining(user.id);
        
        if (minutesLeft > 0) {
            return { canView: true, reason: `You have ${minutesLeft} minutes of free viewing time remaining this month.` };
        } else {
            return { canView: false, reason: 'Your free viewing time has expired for this month. Please upgrade for unlimited access.' };
        }
    }

    // Rule 4: Default deny for any other case.
    return { canView: false, reason: 'A membership is required to view the chat.' };
}

/**
 * Determines if a user can create Direct Messages.
 * Only Contributors and Admins can.
 */
export function canCreateDms(user: ChatUser): boolean {
    return user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin';
}

/**
 * Your existing isAdmin helper function.
 */
export function isAdmin(user: ChatUser): boolean {
  return user.role === 'admin' || user.role === 'master-admin';
}
