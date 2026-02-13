'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSpace, useSendMessage, useTimeline, useScrollback } from '@towns-protocol/react-sdk';
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

const LoadingSpinner = () => (
    <div className="text-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
        <p className="font-georgia-pro text-gray-500">Loading Channel Data...</p>
    </div>
);

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
  const [retryCount, setRetryCount] = useState(0);
  const [userRole, setUserRole] = useState<'freemium' | 'participant' | 'contributor'>('freemium');
  const [isAdmin, setIsAdmin] = useState(false);
  
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
  
  const { data: timeline, isLoading: isTimelineLoading, error: timelineError } = useTimeline(channelId);
  const { sendMessage, isPending: isSending, error: sendError } = useSendMessage(channelId);
  
  const { scrollback, isPending: isLoadingHistory, data: scrollbackData } = useScrollback(channelId);

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

  // Load message history on mount
  useEffect(() => {
    if (!channelId || hasLoadedHistory || isLoadingHistory) return;
    
    console.log('📜 Loading message history for channel:', channelId);
    
    scrollback().then((result) => {
      console.log('✅ Message history loaded');
      console.log('   At beginning:', result.terminus);
      console.log('   From miniblock:', result.fromInclusiveMiniblockNum.toString());
      setHasLoadedHistory(true);
    }).catch((error) => {
      console.error('❌ Failed to load message history:', error);
      setHasLoadedHistory(true);
    });
  }, [channelId, hasLoadedHistory, isLoadingHistory, scrollback]);

  // Detect role AND admin status
  useEffect(() => {
    async function detectRole() {
      if (activeAccount?.address) {
        const roleInfo = await getUserRole(activeAccount.address);
        setUserRole(roleInfo.role);
        
        // Check if user is admin in Supabase
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

  // ✅ FETCH LIVE EVENTS WITH IMPROVED LOGGING
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
          console.log('   ID:', data.data[0].id);
          console.log('   Daily Room:', data.data[0].dailyRoomName);
          console.log('   Host ID:', data.data[0].host?.id);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (data.success && data.data.length > 0) {
          const liveEvent = data.data[0];
          setActiveEvent(liveEvent);
          
          // ✅ Check wallet before generating token
          if (!activeAccount?.address) {
            console.warn('⚠️ Wallet not connected yet, skipping token generation');
            return;
          }
          
          if (liveEvent.videoEnabled && liveEvent.dailyRoomName) {
            const isHost = activeAccount.address.toLowerCase() === liveEvent.host?.id?.toLowerCase();
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎫 GENERATING VIDEO TOKEN');
            console.log('   Room Name:', liveEvent.dailyRoomName);
            console.log('   Your Address:', activeAccount.address);
            console.log('   Host Address:', liveEvent.host?.id);
            console.log('   Is Host?:', isHost);
            console.log('   Guest IDs:', liveEvent.guestIds);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            const tokenRes = await fetch('/api/events/generate-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomName: liveEvent.dailyRoomName,
                walletAddress: activeAccount.address,
                isHost: isHost,
              }),
            });
            
            console.log('📋 Token response status:', tokenRes.status);
            
            if (!tokenRes.ok) {
              const errorData = await tokenRes.json();
              console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.error('❌ TOKEN GENERATION FAILED');
              console.error('   Status:', tokenRes.status);
              console.error('   Error:', errorData.error);
              console.error('   Sent data:', {
                roomName: liveEvent.dailyRoomName,
                walletAddress: activeAccount.address,
                isHost: isHost,
              });
              console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              
              if (tokenRes.status === 403) {
                console.warn('🚫 You are not authorized to join this event');
                console.warn('   Make sure you are either:');
                console.warn('   1. The event host');
                console.warn('   2. An invited guest');
              }
              return;
            }
            
            const tokenData = await tokenRes.json();
            
            if (tokenData.success) {
              console.log('✅ Video token generated successfully');
              setDailyToken(tokenData.data.token);
            } else {
              console.error('❌ Token data indicates failure:', tokenData);
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
    
    // ✅ Only fetch if wallet is connected
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

  // Log permissions changes
  useEffect(() => {
    console.log('🔐 PERMISSIONS UPDATE:', {
      userAddress: activeAccount?.address?.slice(0, 8) + '...',
      permissions,
      activeEvent: activeEvent?.id,
      eventIsLive: !!activeEvent,
    });
  }, [permissions, activeAccount?.address, activeEvent]);

  useEffect(() => {
    if (sendError?.message?.includes('BAD_PREV_MINIBLOCK_HASH') && retryCount < 3) {
      console.log(`⚠️ Miniblock hash error, will retry in 2 seconds (attempt ${retryCount + 1}/3)`);
      const timer = setTimeout(() => {
        setRetryCount(retryCount + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sendError, retryCount]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline]);

  // Log raw timeline data (DEBUG)
  useEffect(() => {
    if (timeline && timeline.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 TIMELINE EVENT STRUCTURE CHECK');
      console.log('   Total events:', timeline.length);
      console.log('   First event keys:', Object.keys(timeline[0]));
      console.log('   First event sample:', timeline[0]);
      console.log('   ─────────────────────────────────────────');
      console.log('   eventId:', timeline[0]?.eventId);
      console.log('   eventId type:', typeof timeline[0]?.eventId);
      console.log('   eventId length:', timeline[0]?.eventId?.length);
      console.log('   eventId is hex?:', /^[a-f0-9]+$/.test(timeline[0]?.eventId || ''));
      console.log('   ─────────────────────────────────────────');
      console.log('   hashStr:', timeline[0]?.hashStr);
      console.log('   hash:', timeline[0]?.hash);
      console.log('   id:', timeline[0]?.id);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }, [timeline]);

  // Fetch user profiles for messages
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isFreemiumUser && !hasTimeLeft) {
      alert('⏱️ Your free viewing time has expired. Upgrade to Knead Monthly to continue.');
      return;
    }
    
    if (userRole === 'freemium') {
      alert('👀 Freemium users can only view messages. Upgrade to Knead Monthly to participate.');
      return;
    }
    
    if (!messageInput.trim() || isSending || !channelId) {
      return;
    }

    try {
      console.log('📤 Sending message:', messageInput);
      setRetryCount(0);
      
      await sendMessage(messageInput);
      
      console.log('✅ Message sent successfully');
      setMessageInput('');
    } catch (error: any) {
      console.error('❌ Failed to send message:', error);
      
      if (error.message?.includes('BAD_PREV_MINIBLOCK_HASH')) {
        alert('⏳ Channel is syncing. Please wait a few seconds and try again.');
      } else if (error.message?.includes('already a member')) {
        console.log('ℹ️ Already a member, ignoring error');
      } else {
        alert(`Failed to send message: ${error.message}`);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isFreemiumUser && !hasTimeLeft) {
      alert('⏱️ Your free viewing time has expired. Upgrade to Knead Monthly to continue.');
      return;
    }
    
    if (userRole === 'freemium') {
      alert('👀 Freemium users can only view messages. Upgrade to Knead Monthly to participate.');
      return;
    }

    setIsUploading(true);
    try {
      console.log('📎 Uploading file to IPFS:', file.name);
      const ipfsUri = await uploadToIPFS(file);
      console.log('✅ File uploaded:', ipfsUri);
      
      const fileMessage = `[FILE:${file.name}](${ipfsUri})`;
      await sendMessage(fileMessage);
      
      console.log('✅ File message sent');
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('❌ File upload failed:', error);
      alert(error.message || 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // SINGLE messages mapping (no duplicates)
  const messages = timeline
    ?.filter((event: any) => event.content?.kind === RiverTimelineEvent.ChannelMessage)
    .map((event: any) => {
      const userAddress = event.creatorUserId || '';
      const profile = profileCache[userAddress];
      
      const townEventId = event.eventId || event.hashStr || event.hash || event.id;
      
      return {
        id: townEventId,
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

  useEffect(() => {
    console.log('💬 Total messages loaded:', messages.length);
    console.log('📊 History loaded:', hasLoadedHistory);
    console.log('⏳ Loading history:', isLoadingHistory);
  }, [messages.length, hasLoadedHistory, isLoadingHistory]);

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
    if (isLoadingHistory && messages.length === 0) {
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
        {isLoadingHistory && (
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

  return (
    <>
      <DailyProvider>
        <ChatLayout>
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
                  <div className="bg-gray-50 px-4 py-2 border-b">
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

                  {userRole === 'participant' && activeEvent && (
                    <div className={`px-4 py-3 border-b ${permissions?.canPost ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${permissions?.canPost ? 'text-green-800' : 'text-yellow-800'}`}>
                            {permissions?.canPost 
                              ? '✅ You can send messages during this live event!' 
                              : '⏳ Event is live, waiting for permissions update...'}
                          </p>
                          {!permissions?.canPost && (
                            <p className="text-xs text-yellow-600 mt-1">
                              This usually takes 5-10 seconds. If stuck, click Refresh Access below.
                            </p>
                          )}
                        </div>
                        {!permissions?.canPost && (
                          <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-full text-sm hover:bg-yellow-700 ml-3 whitespace-nowrap"
                          >
                            Refresh Access
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto pb-16">
                    {renderMessages()}
                  </div>

                  <div className="border-t border-gray-200 p-4 bg-white">
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
                          channelId ? "iMessage" : "Loading..."
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
                  </div>
                </div>
              </div>

              <div className="lg:hidden flex flex-col h-screen">
                <div className="border-b border-gray-200">
                  <EventVideoStage 
                    event={activeEvent} 
                    currentUserAddress={activeAccount?.address || ''}
                    roomUrl={activeEvent.dailyRoomUrl}
                    token={dailyToken}
                  />
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b">
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

                  {userRole === 'participant' && activeEvent && (
                    <div className={`px-4 py-3 border-b ${permissions?.canPost ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <div className="flex flex-col gap-2">
                        <p className={`text-sm font-medium ${permissions?.canPost ? 'text-green-800' : 'text-yellow-800'}`}>
                          {permissions?.canPost 
                            ? '✅ You can send messages!' 
                            : '⏳ Waiting for permissions...'}
                        </p>
                        {!permissions?.canPost && (
                          <>
                            <p className="text-xs text-yellow-600">
                              Usually takes 5-10 seconds.
                            </p>
                            <button
                              onClick={() => window.location.reload()}
                              className="px-3 py-1.5 bg-yellow-600 text-white rounded-full text-sm hover:bg-yellow-700 self-start"
                            >
                              Refresh Access
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto pb-16">
                    {renderMessages()}
                  </div>

                  <div className="border-t border-gray-200 p-4 bg-white">
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
                          channelId ? "iMessage" : "Loading..."
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
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col bg-white">
              <div className="bg-gray-50 px-4 py-2 border-b">
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
                <EventBanner eventTitle={activeEvent.title} timeRemaining={undefined} isLive={true} />
              )}

              {userRole === 'participant' && activeEvent && (
                <div className={`px-4 py-3 border-b ${permissions?.canPost ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${permissions?.canPost ? 'text-green-800' : 'text-yellow-800'}`}>
                        {permissions?.canPost 
                          ? '✅ You can send messages during this live event!' 
                          : '⏳ Event is live, waiting for permissions update...'}
                      </p>
                      {!permissions?.canPost && (
                        <p className="text-xs text-yellow-600 mt-1">
                          This usually takes 5-10 seconds. If stuck, click Refresh Access.
                        </p>
                      )}
                    </div>
                    {!permissions?.canPost && (
                      <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-full text-sm hover:bg-yellow-700 ml-3 whitespace-nowrap"
                      >
                        Refresh Access
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto pb-16">
                {renderMessages()}
              </div>

              <div className="border-t border-gray-200 p-4 bg-white">
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
                      channelId ? "iMessage" : "Loading..."
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
              </div>
            </div>
          )}
        </ChatLayout>
      </DailyProvider>
      
      <FreemiumBanner remainingMinutes={remainingMinutes} />
    </>
  );
}
