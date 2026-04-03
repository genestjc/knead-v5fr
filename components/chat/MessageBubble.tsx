'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getMessageEarnings } from '@/lib/blockchain/contract-reads';
import { motion } from 'framer-motion';
import { useAwardOnReaction } from '@/hooks/use-award-on-reaction';
import { useRedact, useSendReaction } from '@towns-protocol/react-sdk';
import { AdminContextMenu } from './AdminContextMenu';
import { FileMessageDisplay } from './FileMessageDisplay';
import { MessageReactions } from './MessageReactions';
import { UserProfilePopup } from './UserProfilePopup';
import { toast } from 'sonner';
import { isImageFile } from '@/lib/thirdweb/storage';

interface ChatMessage {
  id: string;
  content: string;
  sender: {
    id: string;
    walletAddress?: string;
    name: string;
    avatar?: string;
    bio?: string | null;
  };
  timestamp: number | string;
  townsAwarded?: number;
  isOwn?: boolean;
  isContributor?: boolean;
  isDecrypting?: boolean;
  reactionCounts?: Record<string, number>;
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
  isDecrypting?: boolean;
  canReact?: boolean;
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
  const optimisticEarningsRef = useRef<number | null>(null);

  const fetchEarnings = useCallback(async () => {
    if (!participantAddress) return;
    try {
      const total = await getMessageEarnings(messageId, participantAddress);
      
      if (optimisticEarningsRef.current !== null) {
        if (total >= optimisticEarningsRef.current) {
          setEarnings(total);
          optimisticEarningsRef.current = null;
        }
      } else {
        setEarnings(total);
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  }, [messageId, participantAddress]);

  useEffect(() => {
    fetchEarnings();
    const pollInterval = setInterval(fetchEarnings, 30000);
    
    const handleTip = (event: Event) => {
      const customEvent = event as CustomEvent<{ 
        messageId: string;
        participantAddress: string;
        bonusAmount?: number;
      }>;
      
      // Verify both messageId AND participantAddress match
      if (customEvent.detail.messageId === messageId && 
          customEvent.detail.participantAddress === participantAddress) {
        
        // Optimistic update: immediately show the tip
        if (customEvent.detail.bonusAmount) {
          const newOptimisticTotal = earnings + customEvent.detail.bonusAmount;
          setEarnings(newOptimisticTotal);
          optimisticEarningsRef.current = newOptimisticTotal;
        }
        
        // Multiple retries to fetch real blockchain value
        setTimeout(fetchEarnings, 500);
        setTimeout(fetchEarnings, 2000);
        setTimeout(fetchEarnings, 5000);
        setTimeout(fetchEarnings, 10000);
      }
    };
    
    window.addEventListener('message-tipped', handleTip);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('message-tipped', handleTip);
    };
  }, [messageId, participantAddress, fetchEarnings, earnings]);

  const iconColor = isActive ? '#374151' : '#9ca3af';
  const textColor = isActive ? 'text-gray-700' : 'text-gray-400';
  const borderColor = isActive ? 'border-gray-300' : 'border-gray-200';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border ${borderColor} rounded-full bg-white ${isActive ? 'shadow-sm' : 'opacity-60'}`}>
      <svg width="20" height="20" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
        <path d="M546.79,153.24c-49.5,15.516-70.922,28.828-195.42,81.562c-86.719,36.75-157.36,67.219-203.29,87.094c-0.42188,0.14062-0.5625,0.28125-0.5625,0.28125c-13.031,7.2188-32.578,20.156-50.062,41.906c-39.703,49.359-38.484,106.59-36.844,127.08c4.7344,58.172,36.047,98.25,54.75,117.47c7.7344,7.9688,12,18.609,12,29.719v258.14c0,42.328,30.047,78.469,71.531,86.109l430.26,79.969c5.2969,0.9375,10.734,1.5,16.031,1.5h0.14062c14.672,0,28.828-3.6562,41.344-10.453l9.0938-5.7188l329.34-204.84l17.812-11.156l2.25-1.6406c17.766-15.422,27.797-36.469,27.797-59.016v-235.08c0-3.75,1.6875-7.3125,4.4531-9.7969c52.922-47.812,62.531-86.531,62.484-111.89c-0.46875-152.86-354.24-336.1-593.21-261.19zm131.68,836.16c0,20.812-18.891,36.469-39.328,32.625l-430.26-79.828c-15.656-3-27.094-16.594-27.094-32.625v-276.56c0-16.734-6.7969-33.188-19.453-44.062c-30.047-25.688-47.484-56.203-47.484-88.969c0-91.547,48.422-148.97,216.28-142.97c30.188,1.0781,58.219,3.1406,84.328,5.8594c274.13,29.109,329.86,145.69,329.86,229.36c0,32.766-17.391,63.234-47.484,88.969c-12.797,10.875-19.453,27.328-19.453,44.062v264.19z" fill={iconColor} />
      </svg>
      <span className={`text-xs font-medium ${textColor} font-georgia-pro whitespace-nowrap`}>
        {isReacting ? '⏳' : `$${earnings.toFixed(2)}`}
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

function MessageBubbleComponent({
  message,
  isOwn,
  streamId,
  canAwardTokens,
  isAdmin = false,
  eventId,
  channelId,
  spaceId,
  isDecrypting = false,
  canReact = false,
}: MessageBubbleProps) {
  const { awardTokensOnLike, isReacting } = useAwardOnReaction(streamId || '');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  const { redact, isPending: isDeleting } = useRedact(channelId || '');
  const { sendReaction } = useSendReaction(channelId || '');

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const longPressFiredRef = useRef<boolean>(false);

  const formatTime = (timestamp: number | string): string => {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handleLike = async () => {
    if (!message.sender.walletAddress) {
      toast.error('Cannot tip this user: Wallet address not available.', { duration: 3000 });
      return;
    }
    try {
      await awardTokensOnLike(message.id, message.sender.walletAddress, 0.10, '❤️', eventId);
      
      // Dispatch event for optimistic UI update
      window.dispatchEvent(new CustomEvent('message-tipped', { 
        detail: { 
          messageId: message.id,
          participantAddress: message.sender.walletAddress,
          bonusAmount: 0.10,
        } 
      }));
    } catch (error: any) {
      toast.error('Failed to send tip. Please try again.');
    }
  };

  const handleSelfDelete = async () => {
    if (!confirm('Delete your message?')) return;
    try {
      await redact(message.id);
    } catch (error: any) {
      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes('bad_prev_miniblock_hash') || errorMsg.includes('miniblock')) {
        toast.error('🔄 Channel is syncing. Wait a moment and try again.');
      } else if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
        toast.error('❌ Permission denied');
      } else {
        toast.error('Failed to delete message');
      }
    }
  };

  // Quick ❤️ reaction on double-tap/click
  const handleQuickReact = async () => {
    if (!channelId) return;
    try {
      await sendReaction(message.id, '❤️');
    } catch (error) {
      // Silent fail for reactions
    }
  };

  // Double-tap for quick ❤️ (mobile)
  const handleTouchEnd = (e: React.TouchEvent) => {
    const currentTime = Date.now();
    const tapGap = currentTime - lastTapTimeRef.current;

    if (longPressTimerRef.current && !longPressFiredRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    longPressFiredRef.current = false;

    if (tapGap < 300 && tapGap > 0) {
      if (!canReact) {
        lastTapTimeRef.current = 0;
        return;
      }
      e.preventDefault();
      handleQuickReact();
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = currentTime;
    }
  };

  // Double-click for quick ❤️ (desktop)
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!canReact) return;
    e.preventDefault();
    handleQuickReact();
  };

  // Long-press for reaction picker (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    longPressFiredRef.current = false;
    
    longPressTimerRef.current = setTimeout(() => {
      if (canReact) {
        longPressFiredRef.current = true;
        setShowReactionPicker(true);
        
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    }, 350);
  };

  // Long-press for reaction picker (desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canReact) return;
    
    longPressFiredRef.current = false;
    
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setShowReactionPicker(true);
    }, 350);
  };

  const handleMouseUp = () => {
    if (longPressTimerRef.current && !longPressFiredRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressFiredRef.current = false;
  };

  const handleTouchCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressFiredRef.current = false;
  };

  // Right-click for admin context menu (desktop only)
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isAdmin) return;
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  if (isDecrypting || !message.content) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 px-4`}>
        <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} max-w-[70%] items-end`}>
          {!isOwn && <div className="flex-shrink-0 w-5" />}
          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
            <div className="rounded-[18px] px-4 py-2 bg-gray-100 animate-pulse">
              <p className="font-georgia-pro text-sm text-gray-400 italic">🔐 Decrypting message...</p>
            </div>
            <div className="text-xs text-gray-400 mt-1 px-2">
              <span className="font-georgia-pro">{!isOwn && `${message.sender.name} • `}{formatTime(message.timestamp)}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const fileMatch = message.content.match(/\[FILE:(.+?)\]\((.+?)\)/);
  const isFileMessage = !!fileMatch;
  const fileName = fileMatch?.[1];
  const ipfsUri = fileMatch?.[2];
  
  // Check if it's specifically an image file
  const isImageMessage = isFileMessage && fileName ? isImageFile(fileName) : false;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 px-4 group select-none`}
        style={{ WebkitTouchCallout: 'none' }}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} max-w-[70%] items-end relative`}>
          {!isOwn && (
            <div className="flex-shrink-0 w-5">
              {message.isContributor && message.sender.avatar ? (
                <button
                  onClick={() => setShowProfilePopup(true)}
                  className="block w-5 h-5 rounded-full focus:outline-none"
                  aria-label={`View ${message.sender.name}'s profile`}
                >
                  <img src={convertIpfsToGatewayUrl(message.sender.avatar)} alt={message.sender.name} className="w-5 h-5 rounded-full object-cover border-[1.5px] border-gray-200" />
                </button>
              ) : message.isContributor ? (
                <button
                  onClick={() => setShowProfilePopup(true)}
                  className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[9px] font-semibold focus:outline-none"
                  aria-label={`View ${message.sender.name}'s profile`}
                >
                  {message.sender.name.substring(0, 2).toUpperCase()}
                </button>
              ) : (
                <div className="w-5 h-5" />
              )}
            </div>
          )}

          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} relative`}>
            <div 
              className={`rounded-[18px] px-4 py-2 ${isOwn ? 'bg-[#007AFF] text-white' : 'bg-[#E5E5EA] text-black'}`}
              style={{ WebkitTouchCallout: 'none' }}
            >
              {isFileMessage && fileName && ipfsUri ? (
                <FileMessageDisplay fileName={fileName} ipfsUri={ipfsUri} isCurrentUser={isOwn} />
              ) : (
                <p className="font-georgia-pro text-[15px] leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
              )}
            </div>

            {/* Floating Reaction Picker - positioned at bottom for images, top for everything else */}
            {showReactionPicker && canReact && channelId && (
              <div className={`absolute ${isImageMessage ? 'top-full mt-2' : 'bottom-full mb-2'} left-0 z-50`}>
                <MessageReactions
                  messageId={message.id}
                  channelId={channelId}
                  canReact={canReact}
                  reactionCounts={{}}
                  showPicker={true}
                  isAdmin={isAdmin}
                  messageContent={message.content}
                  messageSender={message.sender.name}
                  onReply={(content) => {
                    window.dispatchEvent(new CustomEvent('reply-to-message', {
                      detail: { content, sender: message.sender.name }
                    }));
                  }}
                  onAdminAction={() => {
                    setShowReactionPicker(false);
                    setContextMenuPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                    setShowContextMenu(true);
                  }}
                  onClose={() => setShowReactionPicker(false)}
                />
              </div>
            )}

            <div className={`text-xs text-gray-500 mt-1 px-2 ${isOwn ? 'text-right' : 'text-left'}`}>
              <span className="font-georgia-pro">{!isOwn && `${message.sender.name} • `}{formatTime(message.timestamp)}</span>
            </div>

            {/* Reaction counts and tip button in same row */}
            {!isOwn && !message.isContributor && (
              <div className="flex items-center gap-2 mt-1.5 px-2 flex-wrap">
                {/* Bread tipping button */}
                {streamId && message.sender.walletAddress && (
                  <div className="relative">
                    <button
                      onClick={canAwardTokens ? handleLike : undefined}
                      onMouseEnter={() => !canAwardTokens && setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                      disabled={!canAwardTokens || isReacting}
                      className={`transition-all ${canAwardTokens ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-not-allowed'}`}
                    >
                      <BreadTipButton messageId={message.id} participantAddress={message.sender.walletAddress} isActive={canAwardTokens ?? false} isReacting={isReacting} />
                    </button>
                    {showTooltip && !canAwardTokens && (
                      <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-10 shadow-lg font-georgia-pro">
                        Tipping is only available to Contributors
                        <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    )}
                  </div>
                )}

                {/* Reaction counts */}
                {channelId && message.reactionCounts && Object.keys(message.reactionCounts).length > 0 && (
                  <MessageReactions messageId={message.id} channelId={channelId} canReact={canReact} reactionCounts={message.reactionCounts} showPicker={false} onClose={() => {}} />
                )}
              </div>
            )}

            {/* Reaction counts for own messages or contributors (no bread button) */}
            {(isOwn || message.isContributor) && channelId && message.reactionCounts && Object.keys(message.reactionCounts).length > 0 && (
              <div className={`${isOwn ? 'self-end' : 'self-start'} px-2 mt-1.5`}>
                <MessageReactions messageId={message.id} channelId={channelId} canReact={canReact} reactionCounts={message.reactionCounts} showPicker={false} onClose={() => {}} />
              </div>
            )}

            {/* Delete button for own messages */}
            {isOwn && channelId && (
              <button onClick={handleSelfDelete} disabled={isDeleting} className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded-full disabled:opacity-50" title="Delete message">
                {isDeleting ? <span className="text-xs">⏳</span> : <span className="text-xs">🗑️</span>}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {showContextMenu && isAdmin && channelId && spaceId && (
        <AdminContextMenu message={message} eventId={eventId} channelId={channelId} spaceId={spaceId} position={contextMenuPosition} onClose={() => setShowContextMenu(false)} />
      )}

      <UserProfilePopup
        isOpen={showProfilePopup}
        onClose={() => setShowProfilePopup(false)}
        name={message.sender.name}
        avatar={message.sender.avatar}
        bio={message.sender.bio ?? undefined}
        address={message.sender.walletAddress}
      />
    </>
  );
}

const areMessagePropsEqual = (prevProps: MessageBubbleProps, nextProps: MessageBubbleProps) => {
  if (prevProps.message.id !== nextProps.message.id) return false;
  if (prevProps.message.content !== nextProps.message.content) return false;
  if (prevProps.isDecrypting !== nextProps.isDecrypting) return false;
  if (prevProps.message.sender.name !== nextProps.message.sender.name) return false;
  if (prevProps.message.sender.avatar !== nextProps.message.sender.avatar) return false;
  if (prevProps.message.sender.bio !== nextProps.message.sender.bio) return false;
  if (prevProps.message.sender.walletAddress !== nextProps.message.sender.walletAddress) return false;
  if (prevProps.isOwn !== nextProps.isOwn) return false;
  if (prevProps.isAdmin !== nextProps.isAdmin) return false;
  if (prevProps.canAwardTokens !== nextProps.canAwardTokens) return false;
  if (prevProps.canReact !== nextProps.canReact) return false;
  if (prevProps.message.isContributor !== nextProps.message.isContributor) return false;
  if (prevProps.streamId !== nextProps.streamId) return false;
  if (prevProps.channelId !== nextProps.channelId) return false;
  if (prevProps.spaceId !== nextProps.spaceId) return false;
  if (prevProps.eventId !== nextProps.eventId) return false;
  const prevReactions = JSON.stringify(prevProps.message.reactionCounts || {});
  const nextReactions = JSON.stringify(nextProps.message.reactionCounts || {});
  if (prevReactions !== nextReactions) return false;
  return true;
};

export const MessageBubble = React.memo(MessageBubbleComponent, areMessagePropsEqual);

function EventBannerComponent({ eventTitle, timeRemaining, isLive = true }: { eventTitle: string; timeRemaining?: string; isLive?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 mx-4 rounded-r-lg">
      <div className="flex items-center gap-2">
        {isLive && <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2 h-2 bg-red-500 rounded-full" />}
        <span className="font-adonis text-lg">{isLive ? '🔴 LIVE: ' : '📅 '}{eventTitle}</span>
      </div>
      {timeRemaining && <p className="font-georgia-pro text-sm text-gray-600 mt-1 ml-4">{timeRemaining}</p>}
    </motion.div>
  );
}

export const EventBanner = React.memo(EventBannerComponent);

function TypingIndicatorComponent({ userName }: { userName?: string }) {
  return (
    <div className="flex justify-start mb-4 px-4">
      <div className="flex flex-col items-start max-w-[70%]">
        <div className="rounded-[18px] px-4 py-3 bg-[#E5E5EA]">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div key={i} className="w-2 h-2 bg-gray-500 rounded-full" animate={{ y: [0, -8, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
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

export const TypingIndicator = React.memo(TypingIndicatorComponent);
