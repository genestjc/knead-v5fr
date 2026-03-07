'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSendReaction } from '@towns-protocol/react-sdk';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const REACTION_EMOJIS = ['❤️', '👍', '🔥', '🎉', '✨', '🍞'] as const;

interface MessageReactionsProps {
  messageId: string;
  channelId: string;
  canReact?: boolean;
  reactionCounts?: Record<string, number>;
  showPicker?: boolean;
  onClose?: () => void;
}

export function MessageReactions({
  messageId,
  channelId,
  canReact = false,
  reactionCounts = {},
  showPicker = false,
  onClose,
}: MessageReactionsProps) {
  const [isSending, setIsSending] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const { sendReaction } = useSendReaction(channelId);

  console.log('MessageReactions render:', { messageId, showPicker, canReact, hasOnClose: !!onClose });

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;
    
    console.log('Setting up outside click listener');
    
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        console.log('Clicked outside - closing picker');
        onClose?.();
      }
    };
    
    // Small delay to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPicker, onClose]);

  const handleReact = useCallback(
    async (emoji: string) => {
      if (!canReact || isSending) return;

      console.log('Sending reaction:', emoji);
      setIsSending(true);
      onClose?.();

      try {
        await sendReaction(messageId, emoji);
        toast.success(`Reacted with ${emoji}`);
      } catch (error: any) {
        const msg = error?.message?.toLowerCase() || '';
        console.error('Reaction error:', error);
        if (msg.includes('quorum_failed') || msg.includes('deadline_exceeded')) {
          toast.error('Network busy — reaction may not have been sent.');
        } else if (msg.includes('permission') || msg.includes('not entitled')) {
          toast.error('You do not have permission to react.');
        } else {
          toast.error('Could not send reaction. Please try again.');
        }
      } finally {
        setIsSending(false);
      }
    },
    [canReact, isSending, sendReaction, messageId, onClose]
  );

  const counts = Object.entries(reactionCounts)
    .filter(([, count]) => count > 0)
    .map(([emoji, count]) => ({ emoji, count }));

  // Floating reaction picker (shown on double-click/tap)
  if (showPicker) {
    console.log('Rendering picker');
    return (
      <motion.div
        ref={pickerRef}
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white border-2 border-gray-300 rounded-2xl shadow-2xl p-2"
      >
        <div className="flex gap-2">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              disabled={isSending}
              className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-95 transition-all text-2xl disabled:opacity-50 bg-white"
            >
              {emoji}
            </button>
          ))}
        </div>
      </motion.div>
    );
  }

  // Reaction count pills (always visible when there are reactions)
  if (counts.length === 0) return null;

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {counts.map(({ emoji, count }) => (
        <button
          key={emoji}
          onClick={() => canReact && handleReact(emoji)}
          disabled={!canReact || isSending}
          className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border transition-all font-georgia-pro
            ${canReact
              ? 'border-gray-300 bg-white hover:bg-gray-50 cursor-pointer hover:scale-105 active:scale-95'
              : 'border-gray-200 bg-gray-50 cursor-default opacity-80'
            }`}
          title={canReact ? `React with ${emoji}` : undefined}
        >
          <span>{emoji}</span>
          <span className="text-gray-600 text-[11px]">{count}</span>
        </button>
      ))}
    </div>
  );
}
