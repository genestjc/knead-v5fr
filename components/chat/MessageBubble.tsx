'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ChatMessage {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: number | string;
  townsAwarded?: number;
  isOwn?: boolean;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

/**
 * iMessage-style message bubble component
 * 
 * Features:
 * - Blue bubbles for sent messages (#007AFF)
 * - Gray bubbles for received messages (#E5E5EA)
 * - $TOWNS award badge
 * - Metadata below bubble (sender name, timestamp)
 */
export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const formatTime = (timestamp: number | string): string => {
    const date = typeof timestamp === 'number' 
      ? new Date(timestamp) 
      : new Date(timestamp);
    
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 px-4`}
    >
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
        {/* Message Bubble */}
        <div
          className={`
            rounded-[18px] px-4 py-2 
            ${isOwn 
              ? 'bg-[#007AFF] text-white' 
              : 'bg-[#E5E5EA] text-black'
            }
          `}
        >
          <p className="font-georgia-pro text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>

          {/* $TOWNS Award Badge */}
          {message.townsAwarded && message.townsAwarded > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs opacity-90">
              <span className="font-semibold">
                +{message.townsAwarded.toFixed(2)} $TOWNS
              </span>
              <span>🪙</span>
            </div>
          )}
        </div>

        {/* Metadata below bubble */}
        <div className={`text-xs text-gray-500 mt-1 px-2 ${isOwn ? 'text-right' : 'text-left'}`}>
          <span className="font-georgia-pro">
            {!isOwn && `${message.sender.name} • `}
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Event indicator banner component
 * Shows live event status at the top of chat
 */
interface EventBannerProps {
  eventTitle: string;
  timeRemaining?: string;
  isLive?: boolean;
}

export function EventBanner({ eventTitle, timeRemaining, isLive = true }: EventBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 mx-4 rounded-r-lg"
    >
      <div className="flex items-center gap-2">
        {isLive && (
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 bg-red-500 rounded-full"
          />
        )}
        <span className="font-adonis text-lg">
          {isLive ? '🔴 LIVE: ' : '📅 '}{eventTitle}
        </span>
      </div>
      {timeRemaining && (
        <p className="font-georgia-pro text-sm text-gray-600 mt-1 ml-4">
          {timeRemaining}
        </p>
      )}
    </motion.div>
  );
}

/**
 * Typing indicator component (iMessage-style)
 */
interface TypingIndicatorProps {
  userName?: string;
}

export function TypingIndicator({ userName }: TypingIndicatorProps) {
  return (
    <div className="flex justify-start mb-4 px-4">
      <div className="flex flex-col items-start max-w-[70%]">
        <div className="rounded-[18px] px-4 py-3 bg-[#E5E5EA]">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-gray-500 rounded-full"
                animate={{ y: [0, -8, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        </div>
        {userName && (
          <div className="text-xs text-gray-500 mt-1 px-2">
            <span className="font-georgia-pro">{userName} is typing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
