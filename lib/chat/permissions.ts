import type { ChatUser } from '@/types/chat';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

// Define the permissions object structure
interface UserPermissions {
  canPost: boolean;
  canView: boolean;
  canAwardPoints: boolean;
  canCreateDms: boolean;
  reason?: string;
}

/**
 * Checks if a live event is currently active in any channel.
 * This is the key function for automating chat access for Paid Participants.
 */
async function isLiveEventActive(): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data, error, count } = await supabase
    .from('chat_events') // Your table is named chat_events
    .select('id', { count: 'exact', head: true })
    .eq('status', 'live'); // The status from your EventsManager

  if (error) {
    console.error("Error checking for active events:", error);
    return false; // Fail safely: assume chat is closed
  }

  return (count ?? 0) > 0;
}

/**
 * The new, upgraded permission function.
 * This determines a user's ability to post based on their role and event status.
 */
export async function checkPostingPermissions(user: ChatUser): Promise<{ canPost: boolean; reason: string }> {
  // Rule 1: Banned users can never post.
  if (user.isBanned) {
    return { canPost: false, reason: 'Your account is suspended.' };
  }

  // Rule 2: Contributors and Admins can always post.
  if (user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
    return { canPost: true, reason: 'Full access granted.' };
  }

  // Rule 3: Paid Participants ('premium' members) can post ONLY during live events.
  if (user.membershipTier === 'premium') {
    const isEventLive = await isLiveEventActive();
    if (isEventLive) {
      return { canPost: true, reason: 'Live event is active.' };
    } else {
      return { canPost: false, reason: 'You can post messages during live events.' };
    }
  }

  // Rule 4: Freemium users and all others cannot post.
  return { canPost: false, reason: 'Upgrade to a paid membership to participate in events.' };
}

/**
 * NEW: Checks a user's permission to view a channel.
 * This enforces the 1-hour monthly limit for Freemium users.
 */
export async function checkViewingPermissions(user: ChatUser): Promise<{ canView: boolean; reason: string }> {
    // Rules 1 & 2: Banned users cannot view. Paid members, contributors, and admins can always view.
    if (user.isBanned) {
        return { canView: false, reason: 'Your account is suspended.' };
    }
    if (user.membershipTier === 'premium' || user.role === 'contributor' || user.role === 'admin' || user.role === 'master-admin') {
        return { canView: true, reason: 'Full access.' };
    }

    // Rule 3: Freemium users have a time limit.
    if (user.membershipTier === 'freemium') {
        const supabase = createSupabaseAdmin();
        const { data } = await supabase.rpc('get_freemium_time_left', { p_user_id: user.id });

        const minutesLeft = data || 0;
        if (minutesLeft > 0) {
            return { canView: true, reason: `You have ${minutesLeft} minutes of viewing time left this month.` };
        } else {
            return { canView: false, reason: 'Your free viewing time for this month has been used. Upgrade for unlimited access.' };
        }
    }

    // Rule 4: Default deny
    return { canView: false, reason: 'You must have a membership to view the chat.' };
}

// ... other permission functions like canAwardLikes, isAdmin can remain here ...
export function isAdmin(user: ChatUser): boolean {
  return user.role === 'admin' || user.role === 'master-admin';
}
