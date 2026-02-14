/**
 * Virtual Admin Redact Hook
 * 
 * Provides admin message deletion across all virtual channels.
 * Searches all 4 channels to find and delete the target message.
 * 
 * This makes the sharding transparent to admins - they can delete any message
 * without knowing which channel it's in.
 */

'use client';

import { useState } from 'react';
import { useAdminRedact } from '@towns-protocol/react-sdk';
import { getAllChannelIds, isVirtualShardingEnabled } from '@/lib/role-based-channel-router';

export interface UseVirtualAdminRedactResult {
  virtualAdminRedact: (eventId: string) => Promise<void>;
  isPending: boolean;
}

/**
 * Hook that provides admin redaction across all virtual channels
 * 
 * Automatically searches all channels to find and delete the message.
 * Falls back to single channel if virtual sharding is not enabled.
 */
export function useVirtualAdminRedact(fallbackChannelId?: string): UseVirtualAdminRedactResult {
  const [isPending, setIsPending] = useState(false);
  
  const isShardingEnabled = isVirtualShardingEnabled();
  const channelIds = getAllChannelIds();

  // Get redact functions for all channels (or just fallback)
  const redact1 = useAdminRedact(isShardingEnabled ? channelIds[0] : fallbackChannelId || '');
  const redact2 = useAdminRedact(isShardingEnabled ? channelIds[1] : '');
  const redact3 = useAdminRedact(isShardingEnabled ? channelIds[2] : '');
  const redact4 = useAdminRedact(isShardingEnabled ? channelIds[3] : '');

  /**
   * Try to redact a message from all channels
   * Returns on first successful deletion
   */
  const virtualAdminRedact = async (eventId: string): Promise<void> => {
    // If sharding not enabled, use single channel redact
    if (!isShardingEnabled) {
      if (!redact1.adminRedact) {
        throw new Error('Admin redact function not available');
      }
      setIsPending(true);
      try {
        await redact1.adminRedact(eventId);
        console.log('✅ Message deleted from fallback channel');
      } finally {
        setIsPending(false);
      }
      return;
    }

    console.log('🔍 Searching for message across all channels...');
    console.log('   Event ID:', eventId);
    console.log('   Channels to search:', channelIds.length);

    setIsPending(true);

    try {
      const redactFunctions = [
        redact1.adminRedact,
        redact2.adminRedact,
        redact3.adminRedact,
        redact4.adminRedact,
      ].filter(Boolean);

      if (redactFunctions.length === 0) {
        throw new Error('No admin redact functions available');
      }

      // Try each channel sequentially until one succeeds
      let lastError: Error | null = null;
      let found = false;

      for (let i = 0; i < redactFunctions.length; i++) {
        const redactFn = redactFunctions[i];
        if (!redactFn) continue;

        try {
          console.log(`   Trying channel ${i + 1}/${redactFunctions.length}...`);
          await redactFn(eventId);
          console.log(`   ✅ Message found and deleted from channel ${i + 1}`);
          found = true;
          break; // Success! Stop searching
        } catch (error) {
          console.log(`   ℹ️ Message not in channel ${i + 1} (${error instanceof Error ? error.message : 'Unknown error'})`);
          lastError = error instanceof Error ? error : new Error('Unknown error');
          // Continue to next channel
        }
      }

      if (!found) {
        // Message wasn't found in any channel
        console.error('❌ Message not found in any channel');
        throw lastError || new Error('Message not found in any channel');
      }
    } finally {
      setIsPending(false);
    }
  };

  return {
    virtualAdminRedact,
    isPending: isPending || redact1.isPending || redact2.isPending || redact3.isPending || redact4.isPending,
  };
}
