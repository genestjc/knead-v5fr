'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSendReaction } from '@towns-protocol/react-sdk';
import { motion, AnimatePresence } from 'framer-motion';
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

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;
    
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
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

      setIsSending(true);
      onClose?.();

      try {
        await sendReaction(messageId, emoji);
        toast.success(`Reacted with ${emoji}`);
      } catch (error: any) {
        const msg = error?.message?.toLowerCase() || '';
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

  // Floating reaction picker (shown on long-press)
  if (showPicker) {
    return (
      <AnimatePresence>
        <motion.div
          ref={pickerRef}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30"
        >
          <div className="flex gap-2 p-2 bg-white border border-gray-200 rounded-2xl shadow-xl">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                disabled={isSending}
                className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-95 transition-all text-2xl disabled:opacity-50"
              >
                {emoji}
              </button>
            ))}
          </div>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45"></div>
          </div>
        </motion.div>
      </AnimatePresence>
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
