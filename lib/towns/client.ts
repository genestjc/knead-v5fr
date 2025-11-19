/**
 * Towns Protocol React SDK Integration
 * 
 * Wraps the @towns-protocol/react-sdk for use in Knead chat system.
 * - Uses Web3 wallet authentication (NO API KEY NEEDED)
 * - Must wrap app with TownsSyncProvider
 * - Messages stored on Towns Protocol (decentralized)
 * - Synced to Supabase for point tracking and moderation
 */

import { 
  useAgentConnection,
  useTownsAuthStatus,
  useChannel,
  useSendMessage,
  useReactions,
  useThreads,
  TownsSyncProvider,
} from '@towns-protocol/react-sdk';

/**
 * Connect wallet to Towns Protocol
 * Uses Web3 wallet signatures for authentication (NO API KEY)
 */
export function useTownsConnection() {
  const { connect, disconnect } = useAgentConnection();
  const { isAuthenticated, isLoading: isConnecting } = useTownsAuthStatus();
  
  return {
    connect,
    disconnect,
    isAuthenticated,
    isConnecting,
    error: null, // Towns SDK handles errors internally
  };
}

/**
 * Subscribe to a Towns channel and receive messages in real-time
 * 
 * @param channelId - Channel identifier (e.g., 'general', 'tech')
 * @returns Channel messages, loading state, and error
 */
export function useTownsChannel(channelId: string) {
  const { messages, isLoading, error } = useChannel(channelId);
  
  return {
    messages: messages || [],
    isLoading,
    error,
  };
}

/**
 * Send messages to Towns Protocol channels
 * Can include custom metadata for Knead point system
 * 
 * @example
 * ```tsx
 * const { sendMessage } = useTownsSendMessage();
 * 
 * sendMessage('general', 'Hello!', {
 *   kneadUserId: 'uuid',
 *   eventType: 'discussion',
 * });
 * ```
 */
export function useTownsSendMessage() {
  const { sendMessage, isSending, error } = useSendMessage();
  
  return {
    sendMessage: (channelId: string, content: string, metadata?: Record<string, any>) => {
      return sendMessage(channelId, content, metadata);
    },
    isSending,
    error,
  };
}

/**
 * Handle reactions/likes on Towns messages
 * Can sync with Knead like/point system
 * 
 * @param messageId - Towns message ID
 */
export function useTownsReactions(messageId: string) {
  const { reactions, addReaction, removeReaction } = useReactions(messageId);
  
  return {
    reactions: reactions || [],
    addReaction,
    removeReaction,
  };
}

/**
 * Handle threaded replies on Towns messages
 * 
 * @param messageId - Parent message ID
 */
export function useTownsThreads(messageId: string) {
  const { replies, isLoading } = useThreads(messageId);
  
  return {
    replies: replies || [],
    isLoading,
  };
}

/**
 * Re-export TownsSyncProvider for app-wide sync
 * Wrap your app with this provider in app/providers.tsx
 */
export { TownsSyncProvider };
