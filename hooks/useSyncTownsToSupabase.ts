/**
 * Sync Towns Protocol messages to Supabase
 * 
 * Watches for new messages from Towns and syncs them to Supabase
 * for point tracking, moderation, and analytics.
 */

import { useEffect, useRef, useState } from 'react';
import { useChannel, useTimeline } from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { createClient } from '@supabase/supabase-js';

// Only create Supabase client if running in browser
const getSupabase = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

export function useSyncTownsToSupabase(spaceId: string, channelId: string) {
  // Get channel data and timeline events
  const { data: channel } = useChannel(spaceId, channelId);
  const { data: events, isLoading, error } = useTimeline(channelId);
  
  const [isMounted, setIsMounted] = useState(false);
  const processedIds = useRef(new Set<string>());
  const lastSyncTime = useRef(Date.now());

  // Filter timeline events to only get chat messages
  const messages = events?.filter(
    event => event.content?.kind === RiverTimelineEvent.ChannelMessage
  ) || [];

  // Track when component mounts (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Don't sync until mounted in browser
    if (!isMounted || isLoading || error || !messages || messages.length === 0) {
      return;
    }

    const supabase = getSupabase();
    if (!supabase) return;

    const syncMessages = async () => {
      // Only sync new messages (received in last 10 seconds)
      const recentMessages = messages.filter(
        msg => new Date(msg.createdAtEpochMs || Date.now()).getTime() > lastSyncTime.current - 10000
      );

      for (const message of recentMessages) {
        // Skip if already processed
        const msgId = message.eventId || message.hashStr || '';
        if (!msgId || processedIds.current.has(msgId)) {
          continue;
        }

        try {
          // Check if message already exists in Supabase
          const { data: existing } = await supabase
            .from('chat_messages')
            .select('id')
            .eq('towns_message_id', msgId)
            .maybeSingle();

          if (existing) {
            processedIds.current.add(msgId);
            continue;
          }

          // Get sender's wallet address from Towns message
          const senderAddress = message.creatorUserId || message.content?.author || '';
          
          if (!senderAddress) {
            console.warn('No sender address found for message:', msgId);
            processedIds.current.add(msgId);
            continue;
          }

          // Clean address (remove 'did:' prefix if present, lowercase)
          const cleanAddress = senderAddress
            .replace(/^did:/, '')
            .replace(/^eip155:1:/, '') // Remove EIP-155 chain prefix
            .replace(/^eip155:\d+:/, '') // Remove any EIP-155 chain prefix
            .toLowerCase();

          // Find Knead user by wallet address
          const { data: user } = await supabase
            .from('chat_users')
            .select('id')
            .ilike('address', cleanAddress)
            .maybeSingle();

          if (!user) {
            console.warn(`Knead user not found for address: ${cleanAddress}`);
            processedIds.current.add(msgId);
            continue;
          }

          // Get message text content
          const messageText = message.content?.body?.text || 
                             message.content?.text || 
                             '';

          if (!messageText) {
            console.warn('No message text found:', msgId);
            processedIds.current.add(msgId);
            continue;
          }

          // Insert message into Supabase
          const { error: insertError } = await supabase
            .from('chat_messages')
            .insert({
              channel_id: channelId,
              user_id: user.id,
              content: messageText,
              towns_message_id: msgId,
              created_at: new Date(message.createdAtEpochMs || Date.now()).toISOString(),
            });

          if (insertError) {
            console.error('Failed to sync message to Supabase:', insertError);
          } else {
            console.log('✅ Synced message to Supabase:', msgId);
            processedIds.current.add(msgId);
          }

        } catch (error) {
          console.error('Error syncing message:', error);
          processedIds.current.add(msgId);
        }
      }

      // Update last sync time
      lastSyncTime.current = Date.now();
    };

    syncMessages();
  }, [isMounted, isLoading, error, messages, channelId]);

  return {
    isSyncing: isLoading,
    syncError: error,
    messageCount: messages.length,
  };
}
