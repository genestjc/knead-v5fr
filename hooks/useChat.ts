'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import type { ChatMessage, UserPermissions, ActionType, EventType, ApiResponse } from '@/types/chat';

interface UseChatProps {
  channelId: string;
  userId?: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
  sendMessage: (content: string, replyToId?: string) => Promise<boolean>;
  awardLike: (messageId: string, actionType: ActionType, eventType: EventType) => Promise<boolean>;
  fetchMore: () => Promise<void>;
  hasMore: boolean;
  refetch: () => Promise<void>;
}

export function useChat({ channelId, userId }: UseChatProps): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  // Fetch messages
  const fetchMessages = useCallback(async (before?: string) => {
    try {
      const params = new URLSearchParams({
        channelId,
        limit: '50',
      });

      if (before) {
        params.append('before', before);
      }

      const response = await fetch(`/api/chat/messages?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.data) {
        throw new Error(data.error || 'Failed to fetch messages');
      }

      return {
        messages: data.data.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
        nextCursor: data.nextCursor,
        hasMore: data.hasMore,
      };
    } catch (err) {
      console.error('Error fetching messages:', err);
      throw err;
    }
  }, [channelId]);

  // Fetch permissions
  const fetchPermissions = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/chat/permissions?userId=${userId}&channelId=${channelId}`);
      const data: ApiResponse<UserPermissions> = await response.json();

      if (!response.ok || !data.data) {
        throw new Error(data.error || 'Failed to fetch permissions');
      }

      setPermissions(data.data);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError('Failed to load permissions');
    }
  }, [userId, channelId]);

  // Send message
  const sendMessage = async (content: string, replyToId?: string): Promise<boolean> => {
    if (!userId) {
      setError('User ID is required to send messages');
      return false;
    }

    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          channelId,
          content,
          replyToId,
        }),
      });

      const data: ApiResponse<ChatMessage> = await response.json();

      if (!response.ok || !data.data) {
        setError(data.error || 'Failed to send message');
        return false;
      }

      // Optimistically add message to list
      const newMessage: ChatMessage = {
        ...data.data,
        timestamp: new Date(data.data.timestamp),
      };
      setMessages((prev) => [newMessage, ...prev]);

      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      return false;
    }
  };

  // Award like
  const awardLike = async (
    messageId: string,
    actionType: ActionType,
    eventType: EventType
  ): Promise<boolean> => {
    if (!userId) {
      setError('User ID is required to award likes');
      return false;
    }

    try {
      const response = await fetch('/api/chat/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          contributorId: userId,
          actionType,
          eventType,
        }),
      });

      const data: ApiResponse<{ points: number; budgetRemaining: number }> = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to award like');
        return false;
      }

      // Update message like count locally
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, likesCount: msg.likesCount + 1 } : msg
        )
      );

      // Update permissions budget
      if (permissions && data.data) {
        setPermissions({
          ...permissions,
          distributionBudgetRemaining: data.data.budgetRemaining,
        });
      }

      return true;
    } catch (err) {
      console.error('Error awarding like:', err);
      setError('Failed to award like');
      return false;
    }
  };

  // Fetch more messages (pagination)
  const fetchMore = async () => {
    if (!hasMore || !nextCursor) return;

    try {
      const result = await fetchMessages(nextCursor);
      setMessages((prev) => [...prev, ...result.messages]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError('Failed to load more messages');
    }
  };

  // Refetch messages
  const refetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMessages();
      setMessages(result.messages);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError('Failed to refresh messages');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [messagesResult] = await Promise.all([
          fetchMessages(),
          fetchPermissions(),
        ]);

        setMessages(messagesResult.messages);
        setNextCursor(messagesResult.nextCursor);
        setHasMore(messagesResult.hasMore);
      } catch (err) {
        setError('Failed to load chat data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [channelId, fetchMessages, fetchPermissions]);

  // Real-time subscriptions
  useEffect(() => {
    if (!channelId) return;

    const supabase = createSupabaseClient();

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch full message with user details
          const { data } = await supabase
            .from('chat_messages')
            .select(`
              *,
              chat_users!inner (
                id,
                address,
                display_name,
                avatar,
                role,
                membership_tier,
                contributor_type,
                alias
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            const newMessage: ChatMessage = {
              id: data.id,
              channelId: data.channel_id,
              userId: data.user_id,
              content: data.content,
              timestamp: new Date(data.created_at),
              replyToId: data.reply_to_id,
              likesCount: 0,
              repliesCount: 0,
              isDeleted: false,
              isHidden: false,
              moderationScore: data.moderation_score,
              user: {
                id: data.chat_users.id,
                address: data.chat_users.address,
                displayName: data.chat_users.display_name,
                avatar: data.chat_users.avatar,
                role: data.chat_users.role,
                membershipTier: data.chat_users.membership_tier,
                contributorType: data.chat_users.contributor_type,
                isBanned: false,
                alias: data.chat_users.alias,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            };

            setMessages((prev) => {
              // Check if message already exists (avoid duplicates from optimistic updates)
              if (prev.some((msg) => msg.id === newMessage.id)) {
                return prev;
              }
              return [newMessage, ...prev];
            });
          }
        }
      )
      .subscribe();

    // Subscribe to message likes
    const likesChannel = supabase
      .channel(`likes:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_likes',
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.message_id
                ? { ...msg, likesCount: msg.likesCount + 1 }
                : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(likesChannel);
    };
  }, [channelId]);

  return {
    messages,
    permissions,
    loading,
    error,
    sendMessage,
    awardLike,
    fetchMore,
    hasMore,
    refetch,
  };
}
