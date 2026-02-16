'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAwardOnReaction } from '@/hooks/use-award-on-reaction';
import { useRedact } from '@towns-protocol/react-sdk';
import { AdminContextMenu } from './AdminContextMenu';
import { FileMessageDisplay } from './FileMessageDisplay';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  content: string;
  sender: {
    id: string;
    walletAddress?: string;
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
  channelId?: string;
  spaceId?: string;
}

// ✅ FINAL: Bread Loaf Counter Badge (smaller, subtle gray)
// ✅ FINAL: Bread Loaf Counter Badge (tall rounded dome, more breathing room)
function BreadCounterBadge({ 
  totalTips, 
  isActive, 
  isReacting 
}: { 
  totalTips: number; 
  isActive: boolean; 
  isReacting: boolean;
}) {
  // Simplified: Always use gray, slightly darker when active
  const strokeColor = isActive ? '#4b5563' : '#9ca3af';  // gray-600 : gray-400
  const textColor = isActive ? 'text-gray-700' : 'text-gray-400';

  return (
    <div className="relative inline-flex items-center justify-center w-[90px] h-[50px]">
      {/* Bread loaf outline SVG - ROUNDED DOME TOP */}
      <svg 
        width="90" 
        height="50" 
        viewBox="0 0 90 50" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
      >
        {/* ✅ Tall rounded dome top - classic sandwich bread */}
        <path 
          d="M20 25 C20 12, 28 5, 45 5 C62 5, 70 12, 70 25" 
          stroke={strokeColor}
          strokeWidth="1.8"
          fill="white"
        />
        
        {/* ✅ Left side - straight down with slight curve */}
        <path 
          d="M20 25 C18 26, 17 27, 17 28 L17 42 C17 44, 18 45, 20 45" 
          stroke={strokeColor}
          strokeWidth="1.8"
          fill="white"
        />
        
        {/* ✅ Right side - straight down with slight curve */}
        <path 
          d="M70 25 C72 26, 73 27, 73 28 L73 42 C73 44, 72 45, 70 45" 
          stroke={strokeColor}
          strokeWidth="1.8"
          fill="white"
        />
        
        {/* Bottom edge */}
        <path 
          d="M20 45 L70 45" 
          stroke={strokeColor}
          strokeWidth="1.8"
          fill="white"
        />
        
        {/* Subtle depth shadow at corners */}
        <path 
          d="M21 26 C19 27, 18 28, 18 30" 
          stroke={strokeColor}
          strokeWidth="0.8"
          opacity="0.2"
        />
        <path 
          d="M69 26 C71 27, 72 28, 72 30" 
          stroke={strokeColor}
          strokeWidth="0.8"
          opacity="0.2"
        />
      </svg>

      {/* Counter text - centered with breathing room */}
      <div className={`relative z-10 font-georgia-pro text-[11px] font-normal ${textColor} text-center flex items-center justify-center w-full h-full`}>
        {isReacting ? (
          <span>⏳</span>
        ) : (
          <span className="whitespace-nowrap">
            {totalTips > 0 ? totalTips : '0'} $TOWNS
          </span>
        )}
      </div>
    </div>
  );
}

const convertIpfsToGatewayUrl = (uri: string): string => {
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.thirdwebcdn.com/ipfs/${uri.replace('ipfs://', '')}`;
  }
  return uri;
};

export function MessageBubble({ 
  message, 
  isOwn, 
  streamId, 
  canAwardTokens,
  isAdmin = false,
  eventId,
  channelId,
  spaceId
}: MessageBubbleProps) {
  const { awardTokensOnLike, isReacting } = useAwardOnReaction(streamId || '');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  
  // ✅ Track local tips (optimistic update)
  const [localTips, setLocalTips] = useState(0);
  
  const { redact, isPending: isDeleting } = useRedact(channelId || '');
  
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

  const handleLike = async () => {
    if (!message.sender.walletAddress) {
      console.error('❌ No wallet address for sender:', message.sender.id, message.sender.name);
      
      const errorMsg = 
        message.sender.name === 'Anonymous' 
          ? '⚠️ Cannot tip this user: Their wallet address is not available.'
          : `⚠️ Cannot tip ${message.sender.name}: Their wallet address is not configured yet.`;
      
      toast.error(errorMsg, { duration: 5000 });
      return;
    }
    
    // ✅ Optimistically update the tip counter
    setLocalTips(prev => prev + 10);
    
    try {
      await awardTokensOnLike(
        message.id,
        message.sender.walletAddress,
        10,
        '❤️',
        eventId
      );
      
      toast.success('🍞 Tipped 10 TOWNS!');
    } catch (error: any) {
      // ✅ Revert on error
      setLocalTips(prev => prev - 10);
      console.error('❌ Tip failed:', error);
      toast.error('Failed to send tip. Please try again.');
    }
  };

  const handleSelfDelete = async () => {
    if (!confirm('Delete your message?')) return;

    try {
      console.log('🗑️ User deleting own message:', message.id);
      await redact(message.id);
      toast.success('Message deleted');
    } catch (error: any) {
      console.error('❌ Failed to delete message:', error);
      
      const errorMsg = error?.message?.toLowerCase() || '';
      
      if (errorMsg.includes('bad_prev_miniblock_hash') || errorMsg.includes('miniblock')) {
        toast.error('⏱️ Channel is syncing. Wait a moment and try again.');
      } else if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
        toast.error('❌ Permission denied');
      } else {
        toast.error('Failed to delete message');
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isAdmin) return;
    
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isAdmin) return;
    
    const timer = setTimeout(() => {
      const touch = e.touches[0];
      setContextMenuPosition({ x: touch.clientX, y: touch.clientY });
      setShowContextMenu(true);
    }, 500);
    
    setPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const fileMatch = message.content.match(/\[FILE:(.+?)\]\((.+?)\)/);
  const isFileMessage = !!fileMatch;
  const fileName = fileMatch?.[1];
  const ipfsUri = fileMatch?.[2];

  // ✅ Combine server tips + local optimistic tips
  const totalTips = (message.townsAwarded || 0) + localTips;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 px-4 group`}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} max-w-[70%]`}>
          {/* Avatar (only for other users) */}
          {!isOwn && (
            <div className="flex-shrink-0">
              {message.sender.avatar ? (
                <img
                  src={convertIpfsToGatewayUrl(message.sender.avatar)}
                  alt={message.sender.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                  {message.sender.name.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          )}

          {/* Message content */}
          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} relative`}>
            <div
              className={`
                rounded-[18px] px-4 py-2 
                ${isOwn 
                  ? 'bg-[#007AFF] text-white' 
                  : 'bg-[#E5E5EA] text-black'
                }
              `}
            >
              {isFileMessage && fileName && ipfsUri ? (
                <FileMessageDisplay 
                  fileName={fileName}
                  ipfsUri={ipfsUri}
                  isCurrentUser={isOwn}
                />
              ) : (
                <p className="font-georgia-pro text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}
            </div>

            {/* Timestamp */}
            <div className={`text-xs text-gray-500 mt-1 px-2 ${isOwn ? 'text-right' : 'text-left'}`}>
              <span className="font-georgia-pro">
                {!isOwn && `${message.sender.name} • `}
                {formatTime(message.timestamp)}
              </span>
            </div>

            {/* ✅ NEW: Bread Loaf Counter Badge Button */}
            {!isOwn && streamId && (
              <div className="relative mt-1.5">
                <button
                  onClick={canAwardTokens ? handleLike : undefined}
                  onMouseEnter={() => !canAwardTokens && setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onTouchStart={() => !canAwardTokens && setShowTooltip(true)}
                  onTouchEnd={() => setTimeout(() => setShowTooltip(false), 2000)}
                  disabled={!canAwardTokens || isReacting}
                  className={`transition-transform ${
                    canAwardTokens
                      ? 'cursor-pointer hover:scale-105 active:scale-95'
                      : 'cursor-not-allowed opacity-60'
                  }`}
                  aria-label={canAwardTokens ? `Tip 10 TOWNS (currently ${totalTips} TOWNS)` : "Tipping is only available to Contributors"}
                >
                  <BreadCounterBadge 
                    totalTips={totalTips}
                    isActive={canAwardTokens}
                    isReacting={isReacting}
                  />
                  
                  {/* Lock icon overlay for non-contributors */}
                  {!canAwardTokens && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-sm opacity-60">🔒</span>
                    </div>
                  )}
                </button>
                
                {/* Tooltip for non-contributors */}
                {showTooltip && !canAwardTokens && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-10 shadow-lg">
                    Tipping is only available to Contributors
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                )}
              </div>
            )}

            {/* Self-delete button (shows on hover for own messages) */}
            {isOwn && channelId && (
              <button
                onClick={handleSelfDelete}
                disabled={isDeleting}
                className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded-full disabled:opacity-50"
                title="Delete message"
              >
                {isDeleting ? (
                  <span className="text-xs">⏳</span>
                ) : (
                  <span className="text-xs">🗑️</span>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Admin context menu */}
      {showContextMenu && isAdmin && channelId && spaceId && (
        <AdminContextMenu
          message={message}
          eventId={eventId}
          channelId={channelId}
          spaceId={spaceId}
          position={contextMenuPosition}
          onClose={() => setShowContextMenu(false)}
        />
      )}
    </>
  );
}

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
