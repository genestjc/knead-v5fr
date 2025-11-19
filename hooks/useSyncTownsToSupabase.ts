/**
 * Sync Towns Protocol messages to Supabase
 * 
 * This hook watches for new messages from Towns and syncs them to Supabase
 * for point tracking, moderation, and analytics.
 * 
 * @example
 * ```tsx
 * function ChatChannel({ channelId }: { channelId: string }) {
 *   useSyncTownsToSupabase(channelId);
 *   
 *   return <div>Chat interface...</div>;
 * }
 * ```
 */

import { useEffect, useRef } from 'react';
import { useTownsChannel } from '@/lib/towns/client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useSyncTownsToSupabase(channelId: string) {
  const { messages, isLoading, error } = useTownsChannel(channelId);
  const processedIds = useRef(new Set<string>());

  useEffect(() => {
    if (isLoading || error || !messages.length) {
      return;
    }

    const syncMessages = async () => {
      for (const message of messages) {
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
            .single();

          if (existing) {
            processedIds.current.add(message.id);
            continue;
          }

          // Map Towns DID to Supabase user_id
          // You may need to adjust this based on your user mapping
          const { data: user } = await supabase
            .from('chat_users')
            .select('id')
            .eq('wallet_address', message.author.did)
            .single();

          if (!user) {
            console.warn(`User not found for DID: ${message.author.did}`);
            processedIds.current.add(message.id);
            continue;
          }

          // Insert message into Supabase
          const { error: insertError } = await supabase
            .from('chat_messages')
            .insert({
              channel_id: channelId,
              user_id: user.id,
              content: message.content,
              towns_message_id: message.id,
              towns_metadata: message.metadata || {},
              created_at: message.timestamp,
            });

          if (insertError) {
            console.error('Failed to sync message to Supabase:', insertError);
          } else {
            console.log(`✅ Synced Towns message ${message.id} to Supabase`);
            processedIds.current.add(message.id);
          }

        } catch (error) {
          console.error('Error syncing message:', error);
        }
      }
    };

    syncMessages();
  }, [messages, isLoading, error, channelId]);

  return {
    isSyncing: isLoading,
    error,
  };
}
