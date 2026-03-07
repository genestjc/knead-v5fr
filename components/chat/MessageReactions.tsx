'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSendReaction } from '@towns-protocol/react-sdk';
import { toast } from 'sonner';

const REACTION_EMOJIS = ['❤️', '👍', '🔥', '🎉', '✨', '🍞'] as const;

interface ReactionCount {
  emoji: string;
  count: number;
}

interface MessageReactionsProps {
  messageId: string;
  channelId: string;
  canReact?: boolean;
  reactionCounts?: Record<string, number>;
}

export function MessageReactions({
  messageId,
  channelId,
  canReact = false,
  reactionCounts = {},
}: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const firstEmojiRef = useRef<HTMLButtonElement>(null);
  const { sendReaction } = useSendReaction(channelId);

  // Close picker on Escape key
  useEffect(() => {
    if (!showPicker) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPicker(false);
        toggleBtnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showPicker]);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;
    
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        pickerRef.current && 
        !pickerRef.current.contains(e.target as Node) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(e.target as Node)
      ) {
        setShowPicker(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPicker]);

  // Focus first emoji when picker opens
  useEffect(() => {
    if (showPicker) {
      firstEmojiRef.current?.focus();
    }
  }, [showPicker]);

  const handleReact = useCallback(
    async (emoji: string) => {
      if (!canReact || isSending) return;

      setIsSending(true);
      setShowPicker(false);

      try {
        await sendReaction(messageId, emoji);
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
    [canReact, isSending, sendReaction, messageId]
  );

  const counts: ReactionCount[] = Object.entries(reactionCounts)
    .filter(([, count]) => count > 0)
    .map(([emoji, count]) => ({ emoji, count }));

  const hasCounts = counts.length > 0;
  const hasInteraction = hasCounts || canReact;

  if (!hasInteraction) return null;

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap relative">
      {counts.map(({ emoji, count }) => (
        <button
          key={emoji}
          onClick={() => handleReact(emoji)}
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

      {canReact && (
        <div className="relative" ref={pickerRef}>
          <button
            ref={toggleBtnRef}
            onClick={() => setShowPicker((v) => !v)}
            disabled={isSending}
            className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add reaction"
            aria-label="Add reaction"
            aria-expanded={showPicker}
            aria-haspopup="true"
          >
            {isSending ? '⏳' : '＋'}
          </button>

          {showPicker && (
            <div
              className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-20"
              role="menu"
              aria-label="Reaction picker"
            >
              {REACTION_EMOJIS.map((emoji, index) => (
                <button
                  key={emoji}
                  ref={index === 0 ? firstEmojiRef : undefined}
                  onClick={() => handleReact(emoji)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-base"
                  title={`React with ${emoji}`}
                  role="menuitem"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
