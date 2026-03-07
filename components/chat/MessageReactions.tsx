'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSendReaction } from '@towns-protocol/react-sdk';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Reply, Shield } from 'lucide-react';

const REACTION_EMOJIS = ['❤️', '👍', '🔥', '🎉', '✨', '🍞'] as const;

interface MessageReactionsProps {
  messageId: string;
  channelId: string;
  canReact?: boolean;
  reactionCounts?: Record<string, number>;
  showPicker?: boolean;
  isAdmin?: boolean;
  messageContent?: string;
  messageSender?: string;
  onReply?: (content: string) => void;
  onAdminAction?: () => void;
  onClose?: () => void;
}

export function MessageReactions({
  messageId,
  channelId,
  canReact = false,
  reactionCounts = {},
  showPicker = false,
  isAdmin = false,
  messageContent = '',
  messageSender = '',
  onReply,
  onAdminAction,
  onClose,
}: MessageReactionsProps) {
  const [isSending, setIsSending] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const { sendReaction } = useSendReaction(channelId);

  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
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

  const handleReplyClick = () => {
    onReply?.(messageContent);
    onClose?.();
  };

  const counts = Object.entries(reactionCounts)
    .filter(([, count]) => count > 0)
    .map(([emoji, count]) => ({ emoji, count }));

  if (showPicker) {
    return (
      <motion.div
        ref={pickerRef}
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white border-2 border-gray-300 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Emoji reactions + Reply in same row */}
        <div className="flex items-center gap-1.5 p-2 md:gap-2 md:p-3">
          {/* Reaction emojis */}
          <div className="flex gap-1.5 md:gap-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                disabled={isSending}
                className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-95 transition-all text-xl md:text-2xl disabled:opacity-50 bg-white"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Vertical divider */}
          <div className="w-px h-10 md:h-12 bg-gray-300"></div>

          {/* Reply button with Lucide icon */}
          <button
            onClick={handleReplyClick}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-95 transition-all bg-white"
            title="Reply"
          >
            <Reply className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
          </button>
        </div>

        {/* Admin button row (only if admin) */}
        {isAdmin && (
          <div className="flex gap-2 p-2 pt-0 px-2 md:px-3">
            <button
              onClick={onAdminAction}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-xs md:text-sm font-medium text-red-700"
            >
              <Shield className="w-3 h-3 md:w-4 md:h-4" />
              Admin
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  if (counts.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {counts.map(({ emoji, count }) => (
        <button
          key={emoji}
          onClick={() => canReact && handleReact(emoji)}
          disabled={!canReact || isSending}
          className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border transition-all font-georgia-pro
            ${canReact ? 'border-gray-300 bg-white hover:bg-gray-50 cursor-pointer hover:scale-105 active:scale-95' : 'border-gray-200 bg-gray-50 cursor-default opacity-80'}`}
          title={canReact ? `React with ${emoji}` : undefined}
        >
          <span>{emoji}</span>
          <span className="text-gray-600 text-[11px]">{count}</span>
        </button>
      ))}
    </div>
  );
}
