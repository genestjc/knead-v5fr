/**
 * Towns Protocol Direct Messages (DM) Integration
 * 
 * Wraps Towns SDK DM hooks for 1-on-1 contributor conversations.
 * - Only contributors can create/access DMs
 * - DMs synced to Supabase chat_dms table
 * - Uses Towns useCreateDm, useDm, useUserDms hooks
 */

import { 
  useCreateDm,
  useDm,
  useUserDms,
} from '@towns/react';

/**
 * Create a new direct message conversation
 * 
 * @returns createDm function and loading state
 * 
 * @example
 * ```tsx
 * const { createDm, isCreating } = useCreateTownsDm();
 * const dmId = await createDm('recipient-wallet-address');
 * ```
 */
export function useCreateTownsDm() {
  const { createDm, isLoading: isCreating, error } = useCreateDm();
  
  return {
    createDm,
    isCreating,
    error,
  };
}

/**
 * Subscribe to a specific DM conversation
 * 
 * @param dmId - Towns DM conversation ID
 * @returns DM messages in real-time
 * 
 * @example
 * ```tsx
 * const { messages, isLoading } = useTownsDm('dm-id-123');
 * ```
 */
export function useTownsDm(dmId: string) {
  const { messages, isLoading, error } = useDm(dmId);
  
  return {
    messages: messages || [],
    isLoading,
    error,
  };
}

/**
 * Get all DM conversations for the current user
 * 
 * @returns List of user's DM conversations
 * 
 * @example
 * ```tsx
 * const { dms, isLoading } = useUserTownsDms();
 * 
 * dms.map(dm => (
 *   <DmListItem key={dm.id} dm={dm} />
 * ));
 * ```
 */
export function useUserTownsDms() {
  const { dms, isLoading, error } = useUserDms();
  
  return {
    dms: dms || [],
    isLoading,
    error,
  };
}
