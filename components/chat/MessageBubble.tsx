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
    id: string;          // Towns userId
    walletAddress?: string; // Ethereum address for tipping
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

// Helper function to convert IPFS URIs to gateway URLs
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
  
  // ✅ NEW: Self-delete for own messages
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
      console.error('❌ No wallet address for sender:', message.sender.id);
      alert('Cannot tip: Wallet address not resolved for this user. They may need to set their ENS address.');
      return;
    }
    
    await awardTokensOnLike(
      message.id,
      message.sender.walletAddress,  // ✅ Use wallet address, not userId
      10,
      '❤️',
      eventId
    );
  };

  // ✅ NEW: Handle self-delete
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

              {message.townsAwarded && message.townsAwarded > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs opacity-90">
                  <span className="font-semibold">
                    +{message.townsAwarded.toFixed(2)} $TOWNS
                  </span>
                  <span>🪙</span>
                </div>
              )}
            </div>

            <div className={`text-xs text-gray-500 mt-1 px-2 ${isOwn ? 'text-right' : 'text-left'}`}>
              <span className="font-georgia-pro">
                {!isOwn && `${message.sender.name} • `}
                {formatTime(message.timestamp)}
              </span>
            </div>

            {/* ✅ NEW: Self-delete button (shows on hover for own messages) */}
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

            {/* Tip button (for other users' messages) */}
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
