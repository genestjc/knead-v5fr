'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSpace, useSendMessage, useTimeline, useScrollback } from '@towns-protocol/react-sdk';
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
import { useTownsAgent } from '@/hooks/use-towns-agent';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { uploadToIPFS } from '@/lib/thirdweb/storage';
import { Paperclip } from 'lucide-react';

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
  
  const activeAccount = useActiveAccount();

  const { isFreemiumUser, remainingMinutes, hasTimeLeft } = useFreemiumChatTimer(activeAccount?.address || null);
  const { canAwardTokens } = useContributorPermissions(activeAccount?.address);
  const { permissions, isBanned } = useChatPermissions(activeAccount?.address || null);

  const { data: space, isLoading: isSpaceLoading, error: spaceError } = useSpace(spaceId);
  
  const channelId = space?.channelIds?.[0] || defaultChannelId;
  
  const { data: events } = useTimeline(channelId);
  const { sendMessage, isPending: isSending, error: sendError } = useSendMessage(channelId);
  const { scrollback, isPending: isScrollbackPending } = useScrollback(channelId);

  // ✅ BAN CHECK: Right after all hooks, before any useEffects
  if (isBanned) {
    return (
      <ChatLayout>
        <BanScreen />
      </ChatLayout>
    );
  }
  
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (events && channelId) {
      console.log(`🔑 Channel ${channelId} synced — ${events.length} events loaded`);
      
      if (window.KEY_SHARER_AUTO_MODE) {
        window.KEY_SHARER_CHANNEL_SYNCED = true;
        window.KEY_SHARER_CHANNEL_ID = channelId;
        console.log('🔑 Key sharer: Channel sync confirmed — key fulfillment active');
      }
    } else if (window.KEY_SHARER_AUTO_MODE) {
      window.KEY_SHARER_CHANNEL_SYNCED = false;
      window.KEY_SHARER_CHANNEL_ID = undefined;
    }
  }, [events, channelId]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ Load scrollback immediately on mount (parallel with space initialization)
  useEffect(() => {
  // ✅ OPTIMIZED: Removed isScrollbackPending guard for parallel loading
  if (!channelId) return;
  
  console.log('📜 Loading message history in parallel...');
  
  const loadHistory = async () => {
    try {
      const result = await scrollback();
      console.log(`✅ Loaded history: terminus=${result.terminus}, from block=${result.fromInclusiveMiniblockNum.toString()}`);
    } catch (error) {
      console.error('❌ Failed to load message history:', error);
    }
  };
  
  loadHistory();
}, [channelId, scrollback]); // ✅ Removed isScrollbackPending from dependencies
    
    loadHistory();
  }, [channelId, scrollback, isScrollbackPending]);

  const getProfile = useCallback(async (walletAddress: string) => {
    try {
      const response = await fetch(`/api/chat/user?address=${walletAddress}`);
      const data = await response.json();
      
      if (data.success && data.user) {
        const profile = {
          alias: data.user.alias,
          avatar: data.user.avatar,
          displayName: data.user.displayName,
          walletAddress: walletAddress,
        };
        
        setProfileCache(prev => ({ ...prev, [walletAddress]: profile }));
        return profile;
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
    
    return null;
  }, []);

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
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎥 [EventVideoStage] Fetching live event...');
        
        const response = await fetch('/api/events?status=live', { 
          cache: 'no-store', 
          headers: { 'Cache-Control': 'no-cache' } 
        });
        const data = await response.json();
        
        if (!data.success || !data.data || data.data.length === 0) {
          console.log('   No live events found');
          setActiveEvent(null);
          setDailyToken(null);
          return;
        }
        
        const event = data.data[0];
        console.log('   Event found:', event.title);
        console.log('   Host:', event.host?.address);
        console.log('   Guest addresses:', event.guestAddresses);
        
        setActiveEvent(event);
        
        if (!activeAccount?.address) {
          console.log('⚠️ No active account, skipping token generation');
          return;
        }
        
        const userAddress = activeAccount.address.toLowerCase();
        const isHost = event.host?.address?.toLowerCase() === userAddress;
        
        const isGuest = event.guestAddresses?.some((addr: string) => 
          addr.toLowerCase() === userAddress
        );
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('👤 YOUR WALLET INFO:');
        console.log('   Your Address:', activeAccount.address);
        console.log('   Your Address (lowercase):', userAddress);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔑 HOST CHECK:');
        console.log('   Host address:', event.host?.address);
        console.log('   isHost:', isHost);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('👥 GUEST CHECK:');
        console.log('   Guest addresses:', event.guestAddresses);
        console.log('   Number of guests:', event.guestAddresses?.length || 0);
        console.log('   isGuest:', isGuest);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const shouldGenerateToken = isHost || isGuest;
        
        console.log('🎫 TOKEN GENERATION:');
        console.log('   Should generate token:', shouldGenerateToken);
        
        if (!shouldGenerateToken) {
          console.log('   ❌ Not host or guest - no token generated');
          console.log('   You are a regular chat participant');
          setDailyToken(null);
          return;
        }
        
        if (!event.videoEnabled || !event.dailyRoomName) {
          console.log('   ⚠️ Video not enabled or no room name');
          return;
        }
        
        console.log('   ✅ Generating Daily.co token...');
        
        const tokenResponse = await fetch('/api/events/generate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: event.dailyRoomName,
            walletAddress: activeAccount.address,
            isHost: isHost,
          }),
        });
        
        const tokenData = await tokenResponse.json();
        
        if (tokenData.success && tokenData.data?.token) {
          console.log('   ✅ Token generated successfully!');
          setDailyToken(tokenData.data.token);
        } else {
          console.error('   ❌ Token generation failed:', tokenData);
          setDailyToken(null);
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } catch (error) {
        console.error('❌ Error fetching live event:', error);
        setActiveEvent(null);
        setDailyToken(null);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ Extra safety: Block banned users
    if (isBanned) {
      alert('You are banned from Knead chat.');
      return;
    }
    
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
    
    if (!messageInput.trim() || isSending || !channelId) {
      return;
    }

    const messageToSend = messageInput.trim();
    
    try {
      console.log('📤 Sending message...');
      
      setMessageInput('');
      setFailedMessage(null);
      
      await Promise.race([
        sendMessage(messageToSend),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Message send timed out after 30 seconds')), 30000)
        )
      ]);
      
      console.log('✅ Message sent successfully');
      
    } catch (error: any) {
      console.error('❌ Failed to send message:', error.message);
      
      setMessageInput(messageToSend);
      setFailedMessage(messageToSend);
      
      if (error.message?.includes('timed out')) {
        alert('⏱️ Message send timed out.\n\nThe Towns network may be experiencing issues. Please try again.');
      } else if (error.message?.includes('deadline_exceeded')) {
        alert('⏳ Network timeout. Your message was not delivered. Please try sending again.');
      } else if (error.message?.includes('BAD_PREV_MINIBLOCK_HASH')) {
        alert('⏳ Channel is syncing. Please wait a few seconds and try again.');
      } else if (error.message?.includes('QUORUM_FAILED')) {
        alert('❌ Network error - message not delivered. Please check your connection and try again.');
      } else if (error.message?.includes('not entitled') || error.message?.includes('permission')) {
        alert('❌ You do not have permission to send messages. Contact support.');
      } else {
        alert(`Failed to send: ${error.message}`);
      }
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
      
      const fileMessage = `[FILE:${file.name}](${ipfsUri})`;
      
      await Promise.race([
        sendMessage(fileMessage),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('File upload timeout')), 30000)
        )
      ]);
      
      console.log('✅ File message sent');
      
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

  const messages = useMemo(() => {
    if (!events || events.length === 0) {
      return [];
    }

    console.log(`💬 Processing ${events.length} events`);

    return events
      .filter((event: any) => event.content?.kind === RiverTimelineEvent.ChannelMessage)
      .map((event: any) => {
        const walletAddress = event.sender?.id || '';
        const profile = walletAddress ? profileCache[walletAddress] : null;
        
        if (walletAddress && !profileCache[walletAddress]) {
          getProfile(walletAddress);
        }
        
        return {
          id: event.eventId,
          content: event.content?.body || '',
          sender: {
            id: walletAddress,
            walletAddress: walletAddress,
            name: profile?.alias || profile?.displayName || event.creatorDisplayName || 'Anonymous',
            avatar: profile?.avatar,
          },
          timestamp: event.createdAtEpochMs || event.timestamp || Date.now(),
          isOwn: walletAddress?.toLowerCase() === activeAccount?.address?.toLowerCase(),
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [events, profileCache, activeAccount?.address, getProfile]);

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
    if (isScrollbackPending && messages.length === 0) {
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
        {isScrollbackPending && (
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
        disabled={!permissions?.canPost || isUploading}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={!permissions?.canPost || isUploading}
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
          !permissions?.canPost && userRole === 'participant' ? "💬 Messaging available during live events only" :
          !permissions?.canPost && userRole === 'freemium' ? "🔒 Upgrade to Premium to participate in events" :
          channelId ? "Type a message..." : "Loading..."
        }
        className={`flex-1 px-4 py-3 border rounded-full focus:outline-none focus:ring-2 font-georgia-pro ${
          permissions?.canPost ? 'focus:ring-[#007AFF] border-gray-300' : 'bg-gray-100 border-gray-200 cursor-not-allowed'
        }`}
        disabled={!permissions?.canPost || isSending || isUploading || !channelId}
      />
      <button 
        type="submit" 
        disabled={!permissions?.canPost || !messageInput.trim() || isSending || isUploading || !channelId} 
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
