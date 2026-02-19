'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMessageEarnings } from '@/lib/blockchain/contract-reads';

interface MessageEarningsProps {
  messageId: string;
}

export function MessageEarnings({ messageId }: MessageEarningsProps) {
  const [earnings, setEarnings] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    try {
      const total = await getMessageEarnings(messageId);
      setEarnings(total);
    } catch (error) {
      console.error('Error fetching message earnings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    fetchEarnings();

    // Listen for tip events on this message
    const handleTip = (event: Event) => {
      const customEvent = event as CustomEvent<{ messageId: string }>;
      if (customEvent.detail.messageId === messageId) {
        fetchEarnings();
      }
    };

    window.addEventListener('message-tipped', handleTip);
    return () => window.removeEventListener('message-tipped', handleTip);
  }, [messageId, fetchEarnings]);

  if (isLoading) {
    return null; // Don't show anything while loading
  }

  return (
    <span className="text-sm text-gray-600">
      💎 {earnings.toFixed(0)} $TOWNS
    </span>
  );
}
