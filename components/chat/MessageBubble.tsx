'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getMessageEarnings } from '@/lib/blockchain/contract-reads';
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
  isContributor?: boolean;
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

// Bread Icon Tipping Button
function BreadTipButton({
  messageId,
  participantAddress,
  isActive,
  isReacting,
}: {
  messageId: string;
  participantAddress: string;
  isActive: boolean;
  isReacting: boolean;
}) {
  const [earnings, setEarnings] = useState<number>(0);

  const fetchEarnings = useCallback(async () => {
    if (!participantAddress) return;
    try {
      const total = await getMessageEarnings(messageId, participantAddress);
      setEarnings(total);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  }, [messageId, participantAddress]);

  useEffect(() => {
    fetchEarnings();

    // Poll every 30 seconds for live on-chain updates (same cadence as WalletSummary)
    const pollInterval = setInterval(fetchEarnings, 30000);

    // Also refresh immediately when this specific message is tipped
    const handleTip = (event: Event) => {
      const customEvent = event as CustomEvent<{ messageId: string }>;
      if (customEvent.detail.messageId === messageId) {
        // Small delay to allow the chain to index the tx
        setTimeout(fetchEarnings, 3000);
      }
    };

    window.addEventListener('message-tipped', handleTip);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('message-tipped', handleTip);
    };
  }, [messageId, fetchEarnings]);

  const iconColor = isActive ? '#374151' : '#9ca3af';
  const textColor = isActive ? 'text-gray-700' : 'text-gray-400';
  const borderColor = isActive ? 'border-gray-300' : 'border-gray-200';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border ${borderColor} rounded-full bg-white ${isActive ? 'shadow-sm' : 'opacity-60'}`}>
      {/* Bread Icon */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 1200 1200"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <path
          d="m546.79 153.24c-49.5 15.516-70.922 28.828-195.42 81.562-86.719 36.75-157.36 67.219-203.29 87.094-0.42188 0.14062-0.5625 0.28125-0.5625 0.28125-13.031 7.2188-32.578 20.156-50.062 41.906-39.703 49.359-38.484 106.59-36.844 127.08 4.7344 58.172 36.047 98.25 54.75 117.47 7.7344 7.9688 12 18.609 12 29.719v258.14c0 42.328 30.047 78.469 71.531 86.109l430.26 79.969c5.2969 0.9375 10.734 1.5 16.031 1.5h0.14062c14.672 0 28.828-3.6562 41.344-10.453l9.0938-5.7188 329.34-204.84 17.812-11.156 2.25-1.6406c17.766-15.422 27.797-36.469 27.797-59.016v-235.08c0-3.75 1.6875-7.3125 4.4531-9.7969 52.922-47.812 62.531-86.531 62.484-111.89-0.46875-152.86-354.24-336.1-593.21-261.19zm131.68 836.16c0 20.812-18.891 36.469-39.328 32.625l-430.26-79.828c-15.656-3-27.094-16.594-27.094-32.625v-276.56c0-16.734-6.7969-33.188-19.453-44.062-30.047-25.688-47.484-56.203-47.484-88.969 0-91.547 48.422-148.97 216.28-142.97 30.188 1.0781 58.219 3.1406 84.328 5.8594 274.13 29.109 329.86 145.69 329.86 229.36 0 32.766-17.391 63.234-47.484 88.969-12.797 10.875-19.453 27.328-19.453 44.062v264.19z"
          fill={iconColor}
        />
      </svg>

      {/* On-chain earnings counter */}
      <span className={`text-xs font-medium ${textColor} font-georgia-pro whitespace-nowrap`}>
        {isReacting ? '⏳' : `${earnings.toFixed(0)} $TOWNS`}
      </span>
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
  spaceId,
}: MessageBubbleProps) {
  const { awardTokensOnLike, isReacting } = useAwardOnReaction(streamId || '');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

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

    try {
      await awardTokensOnLike(
        message.id,
        message.sender.walletAddress,
        10,
        '❤️',
        eventId
      );

      // Dispatch event so BreadTipButton can refresh earnings
      window.dispatchEvent(new CustomEvent('message-tipped', { detail: { messageId: message.id } }));
      toast.success('🍞 Tipped 10 TOWNS!');
    } catch (error: any) {
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
        <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} max-w-[70%] items-end`}>

          {/* Avatar column — always occupies w-5 width so all bubbles align flush */}
          {!isOwn && (
            <div className="flex-shrink-0 w-5">
              {message.isContributor && message.sender.avatar ? (
                <img
                  src={convertIpfsToGatewayUrl(message.sender.avatar)}
                  alt={message.sender.name}
                  className="w-5 h-5 rounded-full object-cover border-[1.5px] border-gray-200"
                />
              ) : message.isContributor ? (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[9px] font-semibold">
                  {message.sender.name.substring(0, 2).toUpperCase()}
                </div>
              ) : (
                // Non-contributor: empty placeholder keeps the same width so bubbles line up
                <div className="w-5 h-5" />
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

            {/* Bread Tip Button — only for non-contributors, requires participant wallet address */}
            {!isOwn && !message.isContributor && streamId && message.sender.walletAddress && (
              <div className="relative mt-1.5">
                <button
                  onClick={canAwardTokens ? handleLike : undefined}
                  onMouseEnter={() => !canAwardTokens && setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onTouchStart={() => !canAwardTokens && setShowTooltip(true)}
                  onTouchEnd={() => setTimeout(() => setShowTooltip(false), 2000)}
                  disabled={!canAwardTokens || isReacting}
                  className={`transition-all ${
                    canAwardTokens
                      ? 'cursor-pointer hover:scale-105 active:scale-95'
                      : 'cursor-not-allowed'
                  }`}
                  aria-label={canAwardTokens ? 'Tip 10 TOWNS' : 'Tipping is only available to Contributors'}
                >
                  <BreadTipButton
                    messageId={message.id}
                    participantAddress={message.sender.walletAddress}
                    isActive={canAwardTokens ?? false}
                    isReacting={isReacting}
                  />
                </button>

                {/* Tooltip for non-contributors */}
                {showTooltip && !canAwardTokens && (
                  <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-10 shadow-lg font-georgia-pro">
                    Tipping is only available to Contributors
                    <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
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
