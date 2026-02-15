'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSpace, useSendMessage, useScrollback, useChannel } from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { MessageBubble, EventBanner } from '@/components/chat/MessageBubble';
import { FreemiumBanner } from '@/components/chat/FreemiumBanner';
import { DailyProvider } from '@/components/chat/DailyProvider';
import { EventVideoStage } from '@/components/chat/EventVideoStage';
import type { ChatUser, ChatEvent } from '@/types/chat';
import { useActiveAccount } from 'thirdweb/react';
import { useFreemiumChatTimer } from '@/hooks/use-freemium-chat-timer';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { useChatPermissions } from '@/hooks/use-chat-permissions';
import { useTownsAgent } from '@/hooks/use-towns-agent';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { uploadToIPFS } from '@/lib/thirdweb/storage';
import { Paperclip } from 'lucide-react';
import { useRoleBasedTimeline } from '@/hooks/use-role-based-timeline';
import { isVirtualShardingEnabled } from '@/lib/role-based-channel-router';

const LoadingSpinner = () => (
  <div className="text-center py-10">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
    <p className="font-georgia-pro text-gray-500">Loading Channel Data...</p>
  </div>
);

const VIRTUAL_SHARDING_CUTOFF = new Date('2026-02-14T20:00:00Z').getTime();

interface ConnectedChatProps {
  currentUser: ChatUser;
  spaceId: string;
  defaultChannelId: string;
}

interface UserProfile {
  alias: string | null;
  avatar: string | null;
  displayName: string;
}

function PermissionDebugBanner({ 
  permissions, 
  userRole, 
  activeEvent 
}: { 
  permissions: any; 
  userRole: string; 
  activeEvent: any 
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
  onCancel 
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
  const { isAgentConnected, isAgentConnecting } = useTownsAgent();
  
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
  const [messageInput, setMessageInput] = useState('');
  const [activeEvent, setActiveEvent] = useState<ChatEvent | null>(null);
  const [dailyToken, setDailyToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'freemium' | 'participant' | 'contributor'>('freemium');
  const [isAdmin, setIsAdmin] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profileCache, setProfileCache] = useState<Record<string, UserProfile>>({});
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  
  const activeAccount = useActiveAccount();

  const { isFreemiumUser, remainingMinutes, hasTimeLeft } = useFreemiumChatTimer(activeAccount?.address || null);
  const { canAwardTokens } = useContributorPermissions(activeAccount?.address);
  const { permissions } = useChatPermissions(activeAccount?.address || null);

  const { data: space, isLoading: isSpaceLoading, error: spaceError } = useSpace(spaceId);
  
  const channelId = space?.channelIds?.[0] || defaultChannelId;
  
  const { data: channelData } = useChannel(spaceId, channelId);
  
  const { data: timeline, isLoading: isTimelineLoading, error: timelineError } = useRoleBasedTimeline(channelId);
  
  const channelConfig = useMemo(() => {
    if (!isVirtualShardingEnabled()) {
      return { fallback: channelId };
    }
    return {
      contributors: process.env.NEXT_PUBLIC_CHANNEL_CONTRIBUTORS || '',
      participantsA: process.env.NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A || '',
      participantsB: process.env.NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B || '',
      files: process.env.NEXT_PUBLIC_CHANNEL_FILES || '',
    };
  }, [channelId]);
  
  const sendToContributors = useSendMessage(channelConfig.contributors || channelId);
  const sendToParticipantsA = useSendMessage(channelConfig.participantsA || channelId);
  const sendToParticipantsB = useSendMessage(channelConfig.participantsB || channelId);
  const sendToFiles = useSendMessage(channelConfig.files || channelId);
  const sendToFallback = useSendMessage(channelId);
  
  const scrollbackFallback = useScrollback(channelId);
  const scrollbackContributors = useScrollback(channelConfig.contributors || channelId);
  const scrollbackParticipantsA = useScrollback(channelConfig.participantsA || channelId);
  const scrollbackParticipantsB = useScrollback(channelConfig.participantsB || channelId);
  const scrollbackFiles = useScrollback(channelConfig.files || channelId);
  
  const getSendFunction = useCallback((hasFile: boolean) => {
    if (!isVirtualShardingEnabled() || !activeAccount?.address) {
      return sendToFallback.sendMessage;
    }
    
    if (hasFile) return sendToFiles.sendMessage;
    
    if (userRole === 'contributor') return sendToContributors.sendMessage;
    
    const lastChar = activeAccount.address.slice(-1).toLowerCase();
    const isGroupA = ['0', '1', '2', '3', '4', '5', '6', '7'].includes(lastChar);
    return isGroupA ? sendToParticipantsA.sendMessage : sendToParticipantsB.sendMessage;
  }, [
    activeAccount?.address,
    userRole,
    sendToContributors.sendMessage,
    sendToParticipantsA.sendMessage,
    sendToParticipantsB.sendMessage,
    sendToFiles.sendMessage,
    sendToFallback.sendMessage,
  ]);
  
  const isSending = 
    sendToContributors.isPending ||
    sendToParticipantsA.isPending ||
    sendToParticipantsB.isPending ||
    sendToFiles.isPending ||
    sendToFallback.isPending;
  
  const sendError = 
    sendToContributors.error ||
    sendToParticipantsA.error ||
    sendToParticipantsB.error ||
    sendToFiles.error ||
    sendToFallback.error;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getProfile = useCallback(async (address: string) => {
    try {
      const response = await fetch(`/api/chat/user?address=${address}`);
      const data = await response.json();
      
      if (data.success && data.user) {
        const profile = {
          alias: data.user.alias,
          avatar: data.user.avatar,
          displayName: data.user.displayName,
        };
        
        setProfileCache(prev => ({ ...prev, [address]: profile }));
        return profile;
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
    
    return null;
  }, []);

  useEffect(() => {
    const isAnyScrollbackPending = 
      scrollbackContributors.isPending || 
      scrollbackParticipantsA.isPending || 
      scrollbackParticipantsB.isPending || 
      scrollbackFiles.isPending || 
      scrollbackFallback.isPending;
    
    if (hasLoadedHistory || isAnyScrollbackPending) return;
    
    console.log('📜 Loading message history...');
    
    const loadAllHistory = async () => {
      try {
        if (isVirtualShardingEnabled()) {
          const results = await Promise.all([
            scrollbackContributors.scrollback(),
            scrollbackParticipantsA.scrollback(),
            scrollbackParticipantsB.scrollback(),
            scrollbackFiles.scrollback(),
          ]);
          
          console.log('✅ Message history loaded from all shards');
          results.forEach((result, idx) => {
            console.log(`   Shard ${idx + 1}: At beginning: ${result.terminus}, From block: ${result.fromInclusiveMiniblockNum.toString()}`);
          });
        } else {
          const result = await scrollbackFallback.scrollback();
          console.log('✅ Message history loaded');
          console.log('   At beginning:', result.terminus);
          console.log('   From miniblock:', result.fromInclusiveMiniblockNum.toString());
        }
        
        setHasLoadedHistory(true);
      } catch (error) {
        console.error('❌ Failed to load message history:', error);
        setHasLoadedHistory(true);
      }
    };
    
    loadAllHistory();
  }, [
    hasLoadedHistory,
    scrollbackFallback,
    scrollbackContributors,
    scrollbackParticipantsA,
    scrollbackParticipantsB,
    scrollbackFiles,
    scrollbackFallback.isPending,
    scrollbackContributors.isPending,
    scrollbackParticipantsA.isPending,
    scrollbackParticipantsB.isPending,
    scrollbackFiles.isPending,
  ]);

  useEffect(() => {
    async function detectRole() {
      if (activeAccount?.address) {
        const roleInfo = await getUserRole(activeAccount.address);
        setUserRole(roleInfo.role);
        
        try {
          const response = await fetch(`/api/chat/user?address=${activeAccount.address}`);
          const data = await response.json();
          if (data.success && data.user) {
            const isUserAdmin = data.user.role === 'admin' || data.user.role === 'master-admin';
            setIsAdmin(isUserAdmin);
            console.log('👮 Admin status:', isUserAdmin);
            console.log('👤 User role from DB:', data.user.role);
          } else {
            console.log('⚠️ User not found in database:', activeAccount.address);
          }
        } catch (error) {
          console.error('Failed to check admin status:', error);
        }
      }
    }
    detectRole();
  }, [activeAccount?.address]);

  useEffect(() => {
    async function fetchLiveEvent() {
      try {
        const res = await fetch('/api/events?status=live', { 
          cache: 'no-store', 
          headers: { 'Cache-Control': 'no-cache' } 
        });
        const data = await res.json();
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎪 LIVE EVENT CHECK');
        console.log('   Success:', data.success);
        console.log('   Events found:', data.data?.length || 0);
        if (data.data?.length > 0) {
          console.log('   Event:', data.data[0].title);
          console.log('   Status:', data.data[0].status);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (data.success && data.data.length > 0) {
          const liveEvent = data.data[0];
          setActiveEvent(liveEvent);
          
          if (!activeAccount?.address) {
            console.warn('⚠️ Wallet not connected yet, skipping token generation');
            return;
          }
          
          if (liveEvent.videoEnabled && liveEvent.dailyRoomName) {
            const isHost = liveEvent.host?.address?.toLowerCase() === activeAccount.address.toLowerCase();
            
            const tokenRes = await fetch('/api/events/generate-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomName: liveEvent.dailyRoomName,
                walletAddress: activeAccount.address,
                isHost: isHost,
              }),
            });
            
            if (tokenRes.ok) {
              const tokenData = await tokenRes.json();
              if (tokenData.success) {
                console.log('✅ Video token generated successfully');
                setDailyToken(tokenData.data.token);
              }
            }
          }
        } else {
          setActiveEvent(null);
          setDailyToken(null);
        }
      } catch (error) {
        console.error('❌ Error fetching live event:', error);
      }
    }
    
    if (activeAccount?.address) {
      fetchLiveEvent();
      const interval = setInterval(fetchLiveEvent, 30000);
      
      const supabase = createSupabaseClient();
      const channel = supabase
        .channel('chat_live_events')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'chat_events' 
        }, () => {
          console.log('🔄 Event changed, refetching...');
          fetchLiveEvent();
        })
        .subscribe();
      
      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }
  }, [activeAccount?.address]);

  useEffect(() => {
    console.log('🔐 PERMISSIONS UPDATE:', {
      userAddress: activeAccount?.address?.slice(0, 8) + '...',
      permissions,
      activeEvent: activeEvent?.id,
      eventIsLive: !!activeEvent,
    });
  }, [permissions, activeAccount?.address, activeEvent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline]);

  useEffect(() => {
    if (!timeline) return;
    
    const userAddresses = new Set(
      timeline
        ?.filter((event: any) => event.content?.kind === RiverTimelineEvent.ChannelMessage)
        .map((event: any) => event.creatorUserId)
        .filter(Boolean)
    );
    
    userAddresses.forEach(address => {
      if (!profileCache[address]) {
        getProfile(address);
      }
    });
  }, [timeline, getProfile, profileCache]);

  // ✅ LOG PERMISSION STATE ON EVERY UPDATE
  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 PERMISSION STATE DEBUG:');
    console.log('   permissions object:', permissions);
    console.log('   permissions.canPost:', permissions?.canPost);
    console.log('   permissions.role:', permissions?.role);
    console.log('   permissions.reason:', permissions?.reason);
    console.log('   userRole (local state):', userRole);
    console.log('   isAdmin:', isAdmin);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }, [permissions, userRole, isAdmin]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 PRE-SEND CHECK:', {
      canPost: permissions?.canPost,
      reason: permissions?.reason,
      role: permissions?.role,
      userRole,
      permissions,
    });
    
    // ✅ PERMISSION CHECK COMMENTED OUT FOR TESTING
    /*
    if (!permissions?.canPost) {
      if (userRole === 'freemium') {
        alert('👀 Freemium users can only watch. Upgrade to Knead Monthly to participate!');
      } else if (userRole === 'participant' && !activeEvent) {
        alert('💬 Participants can chat during live events only. Check back when an event starts!');
      } else {
        alert(`Cannot send message: ${permissions?.reason || 'Unknown reason'}`);
      }
      return;
    }
    */
    
    if (!messageInput.trim() || isSending || !channelId) {
      console.log('❌ Basic validation failed:', {
        hasMessage: !!messageInput.trim(),
        isSending,
        hasChannelId: !!channelId,
      });
      return;
    }

    const messageToSend = messageInput.trim();
    
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📤 ATTEMPTING TO SEND MESSAGE');
      console.log('   Message:', messageToSend);
      console.log('   User Role:', userRole);
      console.log('   Sharding Enabled:', isVirtualShardingEnabled());
      console.log('   Channel ID:', channelId);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      console.time('Send Duration');
      
      setMessageInput('');
      setFailedMessage(null);
      
      const sendMessage = getSendFunction(false);
      console.log('   Send function exists:', !!sendMessage);
      
      if (!sendMessage) {
        throw new Error('Send function not available');
      }
      
      console.log('⏳ Calling sendMessage...');
      
      const result = await sendMessage(messageToSend);
      
      console.timeEnd('Send Duration');
      console.log('✅ MESSAGE SENT SUCCESSFULLY!');
      console.log('   Result:', result);
      
      alert('✅ Message sent! Check if it appears in the chat.');
      
    } catch (error: any) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ SEND FAILED');
      console.error('   Error name:', error.name);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      setMessageInput(messageToSend);
      setFailedMessage(messageToSend);
      
      alert(`❌ Send failed: ${error.message}`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!permissions?.canPost) {
      if (userRole === 'freemium') {
        alert('👀 Freemium users can only watch.');
      } else {
        alert('💬 Participants can upload files during events only.');
      }
      return;
    }

    setIsUploading(true);
    try {
      console.log('📎 Uploading file to IPFS:', file.name);
      const ipfsUri = await uploadToIPFS(file);
      console.log('✅ File uploaded:', ipfsUri);
      
      console.log('📁 Sending file message...');
      
      const sendMessage = getSendFunction(true);
      if (!sendMessage) {
        throw new Error('Send function not available');
      }
      
      const fileMessage = `[FILE:${file.name}](${ipfsUri})`;
      const result = await sendMessage(fileMessage);
      
      console.log('✅ File message sent:', result);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('❌ File upload failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const messages = timeline
    ?.filter((event: any) => event.content?.kind === RiverTimelineEvent.ChannelMessage)
    ?.filter((event: any) => {
      const messageTime = event.createdAtEpochMs || event.timestamp || 0;
      return messageTime >= VIRTUAL_SHARDING_CUTOFF;
    })
    .map((event: any) => {
      const userAddress = event.creatorUserId || '';
      const profile = profileCache[userAddress];
      
      return {
        id: event.eventId,
        content: event.content?.body || '',
        sender: {
          id: userAddress,
          name: profile?.alias || profile?.displayName || event.creatorDisplayName || 'Anonymous',
          avatar: profile?.avatar,
        },
        timestamp: event.createdAtEpochMs || event.timestamp || Date.now(),
        isOwn: event.creatorUserId === activeAccount?.address,
      };
    }) || [];

  if (isSpaceLoading || isTimelineLoading) {
    return (
      <ChatLayout>
        <LoadingSpinner />
      </ChatLayout>
    );
  }

  if (spaceError || timelineError) {
    return (
      <ChatLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-red-500 py-8">
            <p className="font-georgia-pro text-lg">❌ Error loading chat</p>
            <p className="font-georgia-pro text-sm mt-2">
              {spaceError?.message || timelineError?.message || 'Unknown error'}
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
    if (scrollbackFallback.isPending && messages.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-500">Loading message history...</p>
          </div>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500 py-8">
            <p className="font-georgia-pro text-lg">No messages yet.</p>
            <p className="font-georgia-pro text-sm mt-2">Be the first to start the conversation!</p>
          </div>
        </div>
      );
    }

    return (
      <div className="py-4">
        {scrollbackFallback.isPending && (
          <div className="text-center py-2">
            <p className="font-georgia-pro text-xs text-gray-400">Loading history...</p>
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

  const renderChatInput = () => (
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
          channelId ? "Type a message..." : "Loading..."
        }
        className="flex-1 px-4 py-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-[#007AFF] border-gray-300 font-georgia-pro"
        disabled={isSending || isUploading || !channelId}
      />
      <button 
        type="submit" 
        disabled={!messageInput.trim() || isSending || isUploading || !channelId} 
        className="w-10 h-10 flex items-center justify-center bg-[#007AFF] text-white rounded-full hover:bg-[#0051D5] transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
        </svg>
      </button>
    </form>
  );

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

          {activeEvent && activeEvent.videoEnabled && dailyToken && activeEvent.dailyRoomUrl ? (
            <>
              <div className="hidden lg:grid lg:grid-rows-2 h-screen">
                <div className="border-b border-gray-200">
                  <EventVideoStage 
                    event={activeEvent} 
                    currentUserAddress={activeAccount?.address || ''}
                    roomUrl={activeEvent.dailyRoomUrl}
                    token={dailyToken}
                  />
                </div>
                
                <div className="flex flex-col overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <p className="font-georgia-pro text-sm text-gray-600">
                        <strong>{space?.metadata?.name || 'Knead Space'}</strong>
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full font-georgia-pro ${
                        userRole === 'contributor' ? 'bg-purple-100 text-purple-800' : 
                        userRole === 'participant' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {userRole === 'contributor' && '⭐ Contributor'}
                        {userRole === 'participant' && '💬 Participant'}
                        {userRole === 'freemium' && '👀 Freemium'}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0">
                    {renderMessages()}
                  </div>

                  <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
                    {renderChatInput()}
                  </div>
                </div>
              </div>

              <div className="lg:hidden flex flex-col h-screen">
                <div className="border-b border-gray-200 flex-shrink-0">
                  <EventVideoStage 
                    event={activeEvent} 
                    currentUserAddress={activeAccount?.address || ''}
                    roomUrl={activeEvent.dailyRoomUrl}
                    token={dailyToken}
                  />
                </div>

                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  <div className="bg-gray-50 px-4 py-2 border-b flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <p className="font-georgia-pro text-sm text-gray-600">
                        <strong>{space?.metadata?.name || 'Knead Space'}</strong>
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full font-georgia-pro ${
                        userRole === 'contributor' ? 'bg-purple-100 text-purple-800' : 
                        userRole === 'participant' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {userRole === 'contributor' && '⭐ Contributor'}
                        {userRole === 'participant' && '💬 Participant'}
                        {userRole === 'freemium' && '👀 Freemium'}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0">
                    {renderMessages()}
                  </div>

                  <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
                    {renderChatInput()}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col h-screen bg-white">
              <div className="bg-gray-50 px-4 py-2 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <p className="font-georgia-pro text-sm text-gray-600">
                    <strong>{space?.metadata?.name || 'Knead Space'}</strong>
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full font-georgia-pro ${
                    userRole === 'contributor' ? 'bg-purple-100 text-purple-800' : 
                    userRole === 'participant' ? 'bg-blue-100 text-blue-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {userRole === 'contributor' && '⭐ Contributor'}
                    {userRole === 'participant' && '💬 Participant'}
                    {userRole === 'freemium' && '👀 Freemium'}
                  </span>
                </div>
              </div>

              {activeEvent && (
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
          )}
        </ChatLayout>
      </DailyProvider>
      
      <FreemiumBanner remainingMinutes={remainingMinutes} />
    </>
  );
}
