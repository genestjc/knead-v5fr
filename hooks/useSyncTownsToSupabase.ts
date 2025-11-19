/**
 * Sync Towns Protocol messages to Supabase
 * 
 * Watches for new messages from Towns and syncs them to Supabase
 * for point tracking, moderation, and analytics.
 */

import { useEffect, useRef } from 'react';
import { useChannel } from '@towns-protocol/react-sdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useSyncTownsToSupabase(channelId: string) {
  const { messages, isLoading, error } = useChannel(channelId);
  const processedIds = useRef(new Set<string>());
  const lastSyncTime = useRef(Date.now());

  useEffect(() => {
    if (isLoading || error || !messages || messages.length === 0) {
      return;
    }

    const syncMessages = async () => {
      // Only sync new messages (received in last 10 seconds)
      const recentMessages = messages.filter(
        msg => new Date(msg.timestamp).getTime() > lastSyncTime.current - 10000
      );

      for (const message of recentMessages) {
        // Skip if already processed
        if (processedIds.current.has(message.id)) {
          continue;
        }

        try {
          // Check if message already exists in Supabase
          const { data: existing } = await supabase
            .from('chat_messages')
            .select('id')
            .eq('towns_message_id', message.id)
            .maybeSingle();

          if (existing) {
            processedIds.current.add(message.id);
            continue;
          }

          // Get sender's wallet address from Towns message
          const senderAddress = message.sender?.address || message.sender?.did || message.senderId;
          
          if (!senderAddress) {
            console.warn('No sender address found for message:', message.id);
            processedIds.current.add(message.id);
            continue;
          }

          // Clean address (remove 'did:' prefix if present, lowercase)
          const cleanAddress = senderAddress
            .replace(/^did:/, '')
            .replace(/^eip155:1:/, '') // Remove EIP-155 chain prefix
            .toLowerCase();

          // Find Knead user by wallet address
          const { data: user } = await supabase
            .from('chat_users')
            .select('id')
            .ilike('address', cleanAddress)
            .maybeSingle();

          if (!user) {
            console.warn(`Knead user not found for address: ${cleanAddress}`);
            processedIds.current.add(message.id);
            continue;
          }

          // Insert message into Supabase
          const { error: insertError } = await supabase
            .from('chat_messages')
            .insert({
              channel_id: channelId,
              user_id: user.id,
              content: message.text || message.content || '',
              towns_message_id: message.id,
              towns_metadata: {
                senderId: message.senderId,
                sender: message.sender,
                metadata: message.metadata,
              },
              created_at: message.timestamp,
            });

          if (!insertError) {
            console.log(`✅ Synced Towns message ${message.id} to Supabase`);
            processedIds.current.add(message.id);

            // Trigger point calculation if metadata includes event info
            if (message.metadata?.eventId && message.metadata?.kneadUserId) {
              try {
                await fetch('/api/chat/calculate-points', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    messageId: message.id,
                    userId: message.metadata.kneadUserId,
                    eventId: message.metadata.eventId,
                  }),
                });
              } catch (pointError) {
                console.error('Point calculation failed:', pointError);
              }
            }
          } else {
            console.error('Failed to insert message:', insertError);
          }

        } catch (error) {
          console.error('Error syncing message:', error);
        }
      }

      // Update last sync time
      lastSyncTime.current = Date.now();
    };

    syncMessages();
  }, [messages, isLoading, error, channelId]);

  return {
    isSyncing: isLoading,
    error,
    syncedCount: processedIds.current.size,
  };
}
