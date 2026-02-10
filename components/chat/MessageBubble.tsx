// components/chat/MessageBubble.tsx

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAwardOnReaction } from '@/hooks/use-award-on-reaction';
import { AdminContextMenu } from './AdminContextMenu';

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
  streamId?: string;
  canAwardTokens?: boolean;
  isAdmin?: boolean;
  eventId?: number;
  channelId?: string;  // ✅ ADD THIS
  spaceId?: string;    // ✅ ADD THIS
}

export function MessageBubble({ 
  message, 
  isOwn, 
  streamId, 
  canAwardTokens,
  isAdmin = false,
  eventId,
  channelId,   // ✅ ADD THIS
  spaceId      // ✅ ADD THIS
}: MessageBubbleProps) {
  const { awardTokensOnLike, isReacting } = useAwardOnReaction(streamId || '');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  
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

  // ✅ Handle like button click
  const handleLike = async () => {
    console.log('❤️ Tip button clicked');
    
    await awardTokensOnLike(
      message.id,
      message.sender.id,
      10, // Base amount: 10 TOWNS
      '❤️'
    );
  };

  // ✅ Handle right-click (desktop)
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isAdmin) return;
    
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // ✅ Handle long-press (mobile)
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isAdmin) return;
    
    const timer = setTimeout(() => {
      const touch = e.touches[0];
      setContextMenuPosition({ x: touch.clientX, y: touch.clientY });
      setShowContextMenu(true);
    }, 500); // 500ms long press
    
    setPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 px-4`}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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

          {/* ✅ Tip button for contributors (not own messages) */}
          {!isOwn && canAwardTokens && streamId && (
            <button
              onClick={handleLike}
              disabled={isReacting}
              className="mt-2 px-3 py-1 text-xs rounded-full bg-white border border-gray-300 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm"
              aria-label="Tip 10 TOWNS"
            >
              {isReacting ? (
                <>⏳ Sending...</>
              ) : (
                <>❤️ Tip 10 TOWNS</>
              )}
            </button>
          )}
        </div>
      </motion.div>

     {/* ✅ Admin Context Menu */}
{showContextMenu && isAdmin && eventId && channelId && spaceId && (
  <AdminContextMenu
    message={message}
    eventId={eventId}
    channelId={channelId}  // ✅ ADD THIS
    spaceId={spaceId}      // ✅ ADD THIS
    position={contextMenuPosition}
    onClose={() => setShowContextMenu(false)}
  />
)}
    </>
  );
}

// ... (EventBanner and TypingIndicator stay the same)

export function EventBanner({ eventTitle, timeRemaining, isLive = true }: {
  eventTitle: string;
  timeRemaining?: string;
  isLive?: boolean;
}) {
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

export function TypingIndicator({ userName }: { userName?: string }) {
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
