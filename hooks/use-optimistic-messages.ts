'use client';

import { useState, useCallback } from 'react';

export interface OptimisticMessage {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
  };
  timestamp: number;
  status: 'sending' | 'sent' | 'failed';
  isOwn: boolean;
}

export function useOptimisticMessages(userId: string) {
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);

  const addOptimisticMessage = useCallback((content: string, senderName: string) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: OptimisticMessage = {
      id: tempId,
      content,
      sender: {
        id: userId,
        name: senderName,
      },
      timestamp: Date.now(),
      status: 'sending',
      isOwn: true,
    };

    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    return tempId;
  }, [userId]);

  const markMessageSent = useCallback((tempId: string) => {
    setOptimisticMessages(prev =>
      prev.map(msg =>
        msg.id === tempId
          ? { ...msg, status: 'sent' as const }
          : msg
      )
    );
    
    // Remove after 2 seconds (real message should be synced by then)
    setTimeout(() => {
      setOptimisticMessages(prev => prev.filter(msg => msg.id !== tempId));
    }, 2000);
  }, []);

  const markMessageFailed = useCallback((tempId: string) => {
    setOptimisticMessages(prev =>
      prev.map(msg =>
        msg.id === tempId
          ? { ...msg, status: 'failed' as const }
          : msg
      )
    );
  }, []);

  const clearOptimisticMessages = useCallback(() => {
    setOptimisticMessages([]);
  }, []);

  return {
    optimisticMessages,
    addOptimisticMessage,
    markMessageSent,
    markMessageFailed,
    clearOptimisticMessages,
  };
}
