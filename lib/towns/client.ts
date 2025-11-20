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
  useChannel,
  useSendMessage,
  useReactions,
  useThreads,
  useTimeline,
  TownsSyncProvider,
} from '@towns-protocol/react-sdk';

/**
 * Connect wallet to Towns Protocol
 * Uses Web3 wallet signatures for authentication (NO API KEY)
 */
export function useTownsConnection() {
  const { connect, disconnect, isAgentConnected, isAgentConnecting } = useAgentConnection();
  
  return {
    connect,
    disconnect,
    isAuthenticated: isAgentConnected,
    isConnecting: isAgentConnecting,
    error: null, // Towns SDK handles errors internally
  };
}

/**
 * Subscribe to a Towns channel and receive messages in real-time
 * 
 * @param spaceId - Space identifier
 * @param channelId - Channel identifier (e.g., 'general', 'tech')
 * @returns Channel data and timeline events
 */
export function useTownsChannel(spaceId: string, channelId: string) {
  const { data: channel, isLoading: channelLoading } = useChannel(spaceId, channelId);
  const { data: events, isLoading: eventsLoading, error } = useTimeline(channelId);
  
  return {
    channel,
    events: events || [],
    isLoading: channelLoading || eventsLoading,
    error,
  };
}

/**
 * Send messages to Towns Protocol channels
 * Can include custom metadata for Knead point system
 * 
 * @param channelId - Channel to send message to
 * @example
 * ```tsx
 * const { sendMessage } = useTownsSendMessage('general');
 * 
 * await sendMessage('Hello!', {
 *   kneadUserId: 'uuid',
 *   eventType: 'discussion',
 * });
 * ```
 */
export function useTownsSendMessage(channelId: string) {
  const { sendMessage, isPending, error } = useSendMessage(channelId);
  
  return {
    sendMessage: (content: string, metadata?: Record<string, any>) => {
      return sendMessage(content, metadata);
    },
    isSending: isPending,
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
  const reactions = useReactions(messageId);
  
  return {
    reactions: reactions || [],
    // Note: addReaction and removeReaction APIs may need verification
  };
}

/**
 * Handle threaded replies on Towns messages
 * 
 * @param messageId - Parent message ID
 */
export function useTownsThreads(messageId: string) {
  const threads = useThreads(messageId);
  
  return {
    threads: threads || [],
    isLoading: false, // Update based on actual API return
  };
}

/**
 * Re-export TownsSyncProvider for app-wide sync
 * Wrap your app with this provider in app/providers.tsx
 */
export { TownsSyncProvider };
