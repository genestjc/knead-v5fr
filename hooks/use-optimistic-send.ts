'use client';

import { useState, useCallback, useRef } from 'react';
import { useSendMessage } from '@towns-protocol/react-sdk';

export interface OptimisticMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'failed';
}

interface UseOptimisticSendOptions {
  channelId: string;
  userId: string;
  userName: string;
  /** Milliseconds before removing a sent optimistic message (real message should arrive by then) */
  sentRemovalDelay?: number;
}

interface UseOptimisticSendResult {
  optimisticMessages: OptimisticMessage[];
  sendOptimistic: (content: string) => Promise<void>;
  retryMessage: (tempId: string) => Promise<void>;
  dismissMessage: (tempId: string) => void;
  isPending: boolean;
}

/**
 * Hook that wraps useSendMessage to provide optimistic UI updates.
 * Shows messages immediately when sent and handles failures with retry.
 */
export function useOptimisticSend({
  channelId,
  userId,
  userName,
  sentRemovalDelay = 3000,
}: UseOptimisticSendOptions): UseOptimisticSendResult {
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const { sendMessage, isPending } = useSendMessage(channelId);
  const pendingContentRef = useRef<Map<string, string>>(new Map());

  const addOptimistic = useCallback(
    (content: string): string => {
      const tempId = `optimistic-${crypto.randomUUID()}`;
      const msg: OptimisticMessage = {
        id: tempId,
        content,
        senderId: userId,
        senderName: userName,
        timestamp: Date.now(),
        status: 'sending',
      };
      setOptimisticMessages((prev) => [...prev, msg]);
      pendingContentRef.current.set(tempId, content);
      return tempId;
    },
    [userId, userName]
  );

  const markSent = useCallback(
    (tempId: string) => {
      setOptimisticMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'sent' as const } : m))
      );
      setTimeout(() => {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
        pendingContentRef.current.delete(tempId);
      }, sentRemovalDelay);
    },
    [sentRemovalDelay]
  );

  const markFailed = useCallback((tempId: string) => {
    setOptimisticMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' as const } : m))
    );
  }, []);

  const sendOptimistic = useCallback(
    async (content: string) => {
      const tempId = addOptimistic(content);
      try {
        await sendMessage(content);
        markSent(tempId);
      } catch (error) {
        markFailed(tempId);
        throw error;
      }
    },
    [addOptimistic, sendMessage, markSent, markFailed]
  );

  const retryMessage = useCallback(
    async (tempId: string) => {
      const content = pendingContentRef.current.get(tempId);
      if (!content) return;

      setOptimisticMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'sending' as const } : m))
      );

      try {
        await sendMessage(content);
        markSent(tempId);
      } catch (error) {
        markFailed(tempId);
        throw error;
      }
    },
    [sendMessage, markSent, markFailed]
  );

  const dismissMessage = useCallback((tempId: string) => {
    setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
    pendingContentRef.current.delete(tempId);
  }, []);

  return {
    optimisticMessages,
    sendOptimistic,
    retryMessage,
    dismissMessage,
    isPending,
  };
}
