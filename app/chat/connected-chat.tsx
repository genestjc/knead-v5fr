'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAgentConnection, useSpace, useChannel, useSendMessage, useTimeline, useScrollback } from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { MessageBubble, EventBanner } from '@/components/chat/MessageBubble';
import { BanScreen } from '@/components/chat/BanScreen';
import { FreemiumBanner } from '@/components/chat/FreemiumBanner';
import { DailyProvider } from '@/components/chat/DailyProvider';
import { EventVideoStage } from '@/components/chat/EventVideoStage';
import type { ChatUser, ChatEvent } from '@/types/chat';
import { useActiveAccount } from 'thirdweb/react';
import { useFreemiumChatTimer } from '@/hooks/use-freemium-chat-timer';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { useChatPermissions } from '@/hooks/use-chat-permissions';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { uploadToIPFS, isImageFile } from '@/lib/thirdweb/storage';
import { Paperclip, X } from 'lucide-react';

const LoadingSpinner = () => (
  <div className="text-center py-10">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
    <p className="font-georgia-pro text-gray-500">Loading Channel Data...</p>
  </div>
);

interface ConnectedChatProps {
  currentUser: ChatUser;
  spaceId: string;
  defaultChannelId: string;
}

interface UserProfile {
  alias: string | null;
  avatar: string | null;
  displayName: string;
  walletAddress: string | null;
  role?: string;
}

function PermissionDebugBanner({
  permissions,
  userRole,
  activeEvent,
}: {
  permissions: any;
  userRole: string;
  activeEvent: any;
}) {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex gap-4">
          <span>Role: <strong>{userRole}</strong></span>
          <span>Can post: <strong>{permissions?.canPost ? '✅' : '❌'}</strong></span>
          <span>Event: <strong>{activeEvent?.title || '❌ None'}</strong></span>
        </div>
        <span className="text-gray-600">{permissions?.reason}</span>
      </div>
    </div>
  );
}

function RetryMessageBanner({
  message,
  onRetry,
  onCancel,
}: {
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">❌ Message failed to send</p>
          <p className="text-xs text-red-600 truncate mt-1">"{message}"</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onRetry}
            className="px-3 py-1.5 bg-red-600 text-white rounded-full text-sm hover:bg-red-700 whitespace-nowrap"
          >
            Retry
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-full text-sm hover:bg-gray-300 whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConnectedChat(props: ConnectedChatProps) {
  const { isAgentConnected, isAgentConnecting } = useAgentConnection();

  if (isAgentConnecting) {
    return (
      <ChatLayout>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-500">Connecting to Towns Protocol...</p>
          <p className="font-georgia-pro text-xs text-gray-400 mt-2">Establishing secure session...</p>
        </div>
      </ChatLayout>
    );
  }

  if (!isAgentConnected) {
    return (
      <ChatLayout>
        <div className="text-center py-10">
          <p className="font-georgia-pro text-lg text-red-500">❌ Not connected to Towns Protocol</p>
          <p className="font-georgia-pro text-sm text-gray-600 mt-2">
            Please connect your wallet to use the chat
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800"
          >
            Retry Connection
          </button>
        </div>
      </ChatLayout>
    );
  }

  return <ConnectedChatInner {...props} />;
}

function ConnectedChatInner({ currentUser, spaceId, defaultChannelId }: ConnectedChatProps) {
  // -- All useState hooks --
  const [messageInput, setMessageInput] = useState('');
  const [activeEvent, setActiveEvent] = useState<ChatEvent | null>(null);
  const [dailyToken, setDailyToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'freemium' | 'participant' | 'contributor'>('freemium');
  const [isAdmin, setIsAdmin] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; previewUrl: string } | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, UserProfile>>({});
  const [scrollbackTimedOut, setScrollbackTimedOut] = useState(false);
  const [isAwaitingKeys, setIsAwaitingKeys] = useState(false);

  // -- All useRef hooks --
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profileFetchingRef = useRef<Set<string>>(new Set());
  const scrollbackCalledRef = useRef(false);
  const keysArrivedRef = useRef(false);
  const hasReScrolledRef = useRef(false);

  // -- All context/external hooks --
  const activeAccount = useActiveAccount();
  const { isFreemiumUser, remainingMinutes, hasTimeLeft } = useFreemiumChatTimer(activeAccount?.address || null);
  const { canAwardTokens } = useContributorPermissions(activeAccount?.address);
  const { permissions, isBanned } = useChatPermissions(activeAccount?.address || null);
  const { data: space, isLoading: isSpaceLoading, error: spaceError } = useSpace(spaceId);

  const channelId = space?.channelIds?.[0] || defaultChannelId;

  const { data: channel } = useChannel(channelId);
  const { data: events } = useTimeline(channelId);
  const { sendMessage, isPending: isSending, error: sendError } = useSendMessage(channelId);
  const { scrollback, isPending: isScrollbackPending } = useScrollback(channelId);

  // -- All useCallback hooks --
  const getProfile = useCallback(async (walletAddress: string) => {
    try {
      const response = await fetch(`/api/chat/user?address=${walletAddress}`);
      const data = await response.json();

      if (data.success && data.user) {
        setProfileCache(prev => ({
          ...prev,
          [walletAddress]: {
            alias: data.user.alias,
            avatar: data.user.avatar,
            displayName: data.user.displayName,
            walletAddress,
            role: data.user.role,
          },
        }));
      }
    } catch {
      // Silent — profile fetch is non-critical
    }
  }, []);

  // ✅ FIXED: Only run scrollback when channel is fully ready
  useEffect(() => {
    if (!channelId) {
      console.log('⏳ Waiting for channelId...');
      return;
    }

    if (!channel) {
      console.log('⏳ Waiting for channel to initialize...');
      return;
    }
    
    if (scrollbackCalledRef.current) {
      console.log('✅ Scrollback already called');
      return;
    }
    
    scrollbackCalledRef.current = true;

    const loadHistory = async () => {
      console.log('📜 Channel ready! Starting scrollback...');
      console.log('📜 Channel ID:', channelId);
      console.log('📜 Channel members:', channel.memberIds?.length || 0);

      const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
        Promise.race([
          promise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Scrollback timed out after ${ms}ms`)), ms)
          ),
        ]);

      try {
        console.log('📜 Loading page 1...');
        const result = await withTimeout(scrollback(), 15000);
        console.log('✅ Page 1 loaded:', result);

        if (result && !result.terminus) {
          console.log('📜 Loading page 2...');
          const result2 = await withTimeout(scrollback(), 15000);
          console.log('✅ Page 2 loaded:', result2);
        }
        
        console.log('✅ Scrollback completed successfully');
      } catch (err: any) {
        console.error('❌ Scrollback error:', err?.message || err);
        
        // Check if it's still pending (hung promise)
        if (isScrollbackPending) {
          console.error('⚠️ Scrollback promise is stuck! Network or encryption issue.');
        }
      }
    };

    loadHistory();
  }, [channelId, channel]);

  // ✅ Reset all refs when channel changes
  useEffect(() => {
    scrollbackCalledRef.current = false;
    keysArrivedRef.current = false;
    hasReScrolledRef.current = false;
  }, [channelId]);

  // ✅ Timeout increased to 30 seconds
  useEffect(() => {
    if (!channelId) return;
    
    const timeout = setTimeout(() => {
      setScrollbackTimedOut(true);
      console.log('⏱️ Stopped waiting for message history');
    }, 30000);
    
    return () => clearTimeout(timeout);
  }, [channelId]);

  // ✅ Profile fetching with deduplication ref
  useEffect(() => {
    if (!events || events.length === 0) return;

    const addresses = events
      .map((event: any) => event.sender?.id)
      .filter(
        (addr): addr is string =>
          !!addr && !profileCache[addr] && !profileFetchingRef.current.has(addr),
      );

    if (addresses.length === 0) return;

    addresses.forEach((addr) => {
      profileFetchingRef.current.add(addr);
      getProfile(addr);
    });
  }, [events, profileCache, getProfile]);

  // ✅ Detect if waiting for decryption keys
  useEffect(() => {
    if (!events || events.length === 0) return;

    const channelMessages = events.filter(
      (event: any) => event.content?.kind === RiverTimelineEvent.ChannelMessage,
    );

    const awaitingKeys =
      channelMessages.length > 0 &&
      channelMessages.every((event: any) => !event.content?.body);

    setIsAwaitingKeys(awaitingKeys);
  }, [events]);

  // ✅ Re-fetch when keys arrive (no infinite loop)
  useEffect(() => {
    if (!isAwaitingKeys && keysArrivedRef.current && !hasReScrolledRef.current) {
      console.log('🔑 Keys arrived! Re-fetching to decrypt messages...');
      hasReScrolledRef.current = true;
      
      scrollback()
        .then(() => scrollback())
        .then(() => console.log('✅ Messages re-decrypted successfully'))
        .catch((err) => console.warn('⚠️ Re-scrollback failed:', err));
    }
    
    if (isAwaitingKeys) {
      keysArrivedRef.current = true;
    }
  }, [isAwaitingKeys, scrollback]);

  // useMemo with NO side effects
  const messages = useMemo(() => {
    if (!events || events.length === 0) return [];

    return events
      .filter((event: any) => event.content?.kind === RiverTimelineEvent.ChannelMessage)
      .map((event: any) => {
        const walletAddress = event.sender?.id || '';
        const profile = walletAddress ? profileCache[walletAddress] : null;

        return {
          id: event.eventId,
          content: event.content?.body || '',
          sender: {
            id: walletAddress,
            walletAddress,
            name: profile?.alias || profile?.displayName || event.creatorDisplayName || 'Anonymous',
            avatar: profile?.avatar,
          },
          timestamp: event.createdAtEpochMs || event.timestamp || Date.now(),
          isOwn: walletAddress?.toLowerCase() === activeAccount?.address?.toLowerCase(),
          isContributor: profile?.role === 'contributor' || profile?.role === 'admin' || profile?.role === 'master-admin',
        };
      })
      .sort((a: any, b: any) => a.timestamp - b.timestamp);
  }, [events, profileCache, activeAccount?.address]);

  // -- All other useEffect hooks --
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (events && channelId && window.KEY_SHARER_AUTO_MODE) {
      window.KEY_SHARER_CHANNEL_SYNCED = true;
      window.KEY_SHARER_CHANNEL_ID = channelId;
    } else if (window.KEY_SHARER_AUTO_MODE) {
      window.KEY_SHARER_CHANNEL_SYNCED = false;
      window.KEY_SHARER_CHANNEL_ID = undefined;
    }
  }, [events, channelId]);

  useEffect(() => {
    if (!activeAccount?.address) return;

    async function detectRole() {
      const roleInfo = await getUserRole(activeAccount!.address);
      setUserRole(roleInfo.role);

      try {
        const response = await fetch(`/api/chat/user?address=${activeAccount!.address}`);
        const data = await response.json();
        if (data.success && data.user) {
          setIsAdmin(data.user.role === 'admin' || data.user.role === 'master-admin');
        }
      } catch {
        // Silent
      }
    }

    detectRole();
  }, [activeAccount?.address]);

  useEffect(() => {
    if (!activeAccount?.address) return;

    async function fetchLiveEvent() {
      try {
        const response = await fetch('/api/events?status=live', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        const data = await response.json();

        if (!data.success || !data.data?.length) {
          setActiveEvent(null);
          setDailyToken(null);
          return;
        }

        const event = data.data[0];
        setActiveEvent(event);

        const userAddress = activeAccount.address!.toLowerCase();
        const isHost = event.host?.address?.toLowerCase() === userAddress;
        const isGuest = event.guestAddresses?.some(
          (addr: string) => addr.toLowerCase() === userAddress,
        );
        const isViewer = !isHost && !isGuest;

        if (!event.videoEnabled || !event.dailyRoomName) {
          setDailyToken(null);
          return;
        }

        const tokenResponse = await fetch('/api/events/generate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: event.dailyRoomName,
            walletAddress: activeAccount.address,
            isHost,
            isGuest,
            isViewer,
          }),
        });
        const tokenData = await tokenResponse.json();
        setDailyToken(tokenData.success ? tokenData.data?.token : null);
      } catch {
        setActiveEvent(null);
        setDailyToken(null);
      }
    }

    fetchLiveEvent();
    const interval = setInterval(fetchLiveEvent, 30000);

    const supabase = createSupabaseClient();
    const channel = supabase
      .channel('chat_live_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_events' }, fetchLiveEvent)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [activeAccount?.address]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  if (isBanned) {
    return (
      <ChatLayout>
        <BanScreen />
      </ChatLayout>
    );
  }

  // -- Event handlers --
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isBanned) {
      alert('You are banned from Knead chat.');
      return;
    }

    if (!permissions?.canPost) {
      if (userRole === 'freemium') {
        alert('Free Members can enjoy viewing for 1 hour per month. Sign-up for Knead Monthly to participate in events.');
      } else if (userRole === 'participant' && !activeEvent) {
        alert('Messaging is available to Knead Monthly members during events. Check the calendar in the top left corner to see what\'s happening.');
      } else {
        alert(`Cannot send message: ${permissions?.reason || 'Unknown reason'}`);
      }
      return;
    }

    if (pendingFile) {
      setIsUploading(true);
      const previewUrl = pendingFile.previewUrl;
      try {
        const ipfsUri = await uploadToIPFS(pendingFile.file);
        const fileMessage = `[FILE:${pendingFile.file.name}](${ipfsUri})`;
        setPendingFile(null);

        await Promise.race([
          sendMessage(fileMessage),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('File upload timeout')), 30000),
          ),
        ]);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to upload file. Please try again.');
      } finally {
        URL.revokeObjectURL(previewUrl);
        setIsUploading(false);
      }
      return;
    }

    if (!messageInput.trim() || isSending || !channelId) return;

    const messageToSend = messageInput.trim();

    try {
      setMessageInput('');
      setFailedMessage(null);

      await Promise.race([
        sendMessage(messageToSend),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Message send timed out after 30 seconds')), 30000),
        ),
      ]);
    } catch (error: any) {
      setMessageInput(messageToSend);
      setFailedMessage(messageToSend);

      const msg = error.message || '';
      if (msg.includes('timed out')) {
        alert('⏱️ Message send timed out.\n\nThe Towns network may be experiencing issues. Please try again.');
      } else if (msg.includes('deadline_exceeded')) {
        alert('⏳ Network timeout. Your message was not delivered. Please try sending again.');
      } else if (msg.includes('BAD_PREV_MINIBLOCK_HASH')) {
        alert('⏳ Channel is syncing. Please wait a few seconds and try again.');
      } else if (msg.includes('QUORUM_FAILED')) {
        alert('❌ Network error - message not delivered. Please check your connection and try again.');
      } else if (msg.includes('not entitled') || msg.includes('permission')) {
        alert('❌ You do not have permission to send messages. Contact support.');
      } else {
        alert(`Failed to send: ${msg}`);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!permissions?.canPost) {
      if (userRole === 'freemium') {
        alert('Free Members can only view. Sign-up for Knead Monthly to participate.');
      } else {
        alert('Messaging is available to Knead Monthly members during events.');
      }
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ file, previewUrl });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // -- Render helpers --
  if (isSpaceLoading) {
    return (
      <ChatLayout>
        <LoadingSpinner />
      </ChatLayout>
    );
  }

  if (spaceError) {
    return (
      <ChatLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-red-500 py-8">
            <p className="font-georgia-pro text-lg">❌ Error loading chat</p>
            <p className="font-georgia-pro text-sm mt-2">
              {spaceError?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-black text-white rounded-full"
            >
              Retry
            </button>
          </div>
        </div>
      </ChatLayout>
    );
  }

  const renderMessages = () => {
    if (isScrollbackPending && messages.length === 0 && !scrollbackTimedOut) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-500">Loading message history...</p>
          </div>
        </div>
      );
    }

    if (messages.length === 0 && isAwaitingKeys) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-500">Decrypting messages...</p>
            <p className="font-georgia-pro text-xs text-gray-400 mt-2">
              Waiting for encryption keys from other members
            </p>
          </div>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500 py-8">
            <p className="font-georgia-pro text-lg">No messages yet.</p>
            <p className="font-georgia-pro text-sm mt-2">
              {scrollbackTimedOut 
                ? "Waiting for message keys... New messages will appear as they're sent."
                : "Be the first to start the conversation!"}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="py-4">
        {isScrollbackPending && (
          <div className="text-center py-2">
            <p className="font-georgia-pro text-xs text-gray-400">Loading earlier messages...</p>
          </div>
        )}
        {isAwaitingKeys && messages.length > 0 && (
          <div className="text-center py-2 bg-amber-50 rounded-lg mx-4 mb-2">
            <p className="font-georgia-pro text-xs text-amber-600">
              Some older messages are still being decrypted...
            </p>
          </div>
        )}
        {messages.map((message: any) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.isOwn || false}
            streamId={channelId}
            canAwardTokens={canAwardTokens}
            isAdmin={isAdmin}
            channelId={channelId}
            spaceId={spaceId}
            eventId={activeEvent?.id}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  const renderDisabledMessageBanner = () => {
    if (permissions?.canPost) return null;

    if (userRole === 'freemium') {
      return (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <p className="font-georgia-pro text-sm text-gray-600 text-center">
            Free Members can enjoy viewing for 1 hour per month.{' '}
            <a
              href="/join"
              className="text-[#007AFF] underline hover:text-[#0051D5] transition-colors"
            >
              Sign-up for Knead Monthly
            </a>{' '}
            to participate in events.
          </p>
        </div>
      );
    }

    if (userRole === 'participant' && !activeEvent) {
      return (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <p className="font-georgia-pro text-sm text-gray-600 text-center">
            Messaging is available to Knead Monthly members during events. Check the calendar in the top left corner to see what's happening.
          </p>
        </div>
      );
    }

    return null;
  };

  const renderChatInput = () => {
    if (!permissions?.canPost) {
      return renderDisabledMessageBanner();
    }

    return (
      <div className="flex flex-col gap-2">
        {pendingFile && (
          <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-2xl">
            {isImageFile(pendingFile.file.name) ? (
              <img
                src={pendingFile.previewUrl}
                alt={pendingFile.file.name}
                className="w-16 h-16 object-cover rounded-xl flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-xl flex-shrink-0">
                <span className="text-2xl">📎</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-georgia-pro font-medium text-gray-800 truncate">{pendingFile.file.name}</p>
              <p className="text-xs text-gray-500 font-georgia-pro">
                {(pendingFile.file.size / 1024 / 1024).toFixed(1)} MB · tap send to upload
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(pendingFile.previewUrl);
                setPendingFile(null);
              }}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 text-gray-500 hover:text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder={
              isUploading ? "Uploading..." :
              pendingFile ? "Add a caption or just hit send..." :
              channelId ? "Type a message..." : "Loading..."
            }
            className="flex-1 px-4 py-3 border rounded-full focus:outline-none focus:ring-2 font-georgia-pro focus:ring-[#007AFF] border-gray-300"
            disabled={isSending || isUploading || !channelId}
          />
          <button
            type="submit"
            disabled={(!messageInput.trim() && !pendingFile) || isSending || isUploading || !channelId}
            className="w-10 h-10 flex items-center justify-center bg-[#007AFF] text-white rounded-full hover:bg-[#0051D5] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </form>
      </div>
    );
  };

  const hasVideo = activeEvent && activeEvent.videoEnabled && dailyToken && activeEvent.dailyRoomUrl;

  return (
    <>
      <DailyProvider>
        <ChatLayout>
          <PermissionDebugBanner
            permissions={permissions}
            userRole={userRole}
            activeEvent={activeEvent}
          />

          {failedMessage && (
            <RetryMessageBanner
              message={failedMessage}
              onRetry={() => handleSendMessage({ preventDefault: () => {} } as any)}
              onCancel={() => {
                setFailedMessage(null);
                setMessageInput('');
              }}
            />
          )}

          <div className="flex flex-col h-full bg-white">
            {hasVideo && (
              <div className="flex-shrink-0 h-[40vh] md:h-[45vh] lg:h-[50vh] bg-gray-900">
                <EventVideoStage
                  event={activeEvent}
                  currentUserAddress={activeAccount?.address || ''}
                  roomUrl={activeEvent.dailyRoomUrl}
                  token={dailyToken}
                />
              </div>
            )}

            {activeEvent && !hasVideo && (
              <div className="flex-shrink-0">
                <EventBanner eventTitle={activeEvent.title} timeRemaining={undefined} isLive={true} />
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0">
              {renderMessages()}
            </div>

            <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
              {renderChatInput()}
            </div>
          </div>
        </ChatLayout>
      </DailyProvider>

      <FreemiumBanner remainingMinutes={remainingMinutes} />
    </>
  );
}
