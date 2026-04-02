/**
 * Towns Protocol React SDK Integration
 * Simplified wrapper - no custom metadata support
 */

export { 
  useAgentConnection,
  useChannel,
  useSendMessage,
  useTimeline,
  useSpace,
  useCreateSpace,
  useJoinSpace,
  TownsSyncProvider,
} from '@towns-protocol/react-sdk';

// Remove useTownsSendMessage wrapper - use useSendMessage directly
// Remove useTownsReactions - use SDK's reaction hooks
// Remove useTownsThreads - use SDK's thread hooks
