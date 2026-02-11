'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAgentConnection, useSpace, useSendMessage, useTimeline } from '@towns-protocol/react-sdk';
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
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { uploadToIPFS } from '@/lib/thirdweb/storage';
import { useTownsConnectionMonitor } from '@/hooks/use-towns-connection';
import { recordSyncError } from '@/lib/towns/cache-manager';
import { useOptimisticMessages } from '@/hooks/use-optimistic-messages';

interface ConnectedChatProps {
  currentUser: ChatUser;
  spaceId: string;
  defaultChannelId: string;
}

const LoadingSpinner = () => (
    <div className="text-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
        <p className="font-georgia-pro text-gray-500">Loading Channel Data...</p>
    </div>
);

export default function ConnectedChat(props: ConnectedChatProps) {
  const { isAgentConnected } = useAgentConnection();
  
  if (!isAgentConnected) {
    return (
      <ChatLayout>
        <LoadingSpinner />
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
  const [isUploading, setIsUploading] = useState(false);
  
  const activeEventIdRef = useRef<string | null>(null);
  const dailyTokenRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const activeAccount = useActiveAccount();

  const { isFreemiumUser, remainingMinutes, hasTimeLeft } = useFreemiumChatTimer(activeAccount?.address || null);
  const { canAwardTokens } = useContributorPermissions(activeAccount?.address);
  const { permissions } = useChatPermissions(activeAccount?.address || null);

  const { isConnected, reconnectAttempts } = useTownsConnectionMonitor();

  const {
    optimisticMessages,
    addOptimisticMessage,
    markMessageSent,
    markMessageFailed,
  } = useOptimisticMessages(activeAccount?.address || '');

  const { data: space, isLoading: isSpaceLoading, error: spaceError } = useSpace(spaceId);
  
  const channelId = space?.channelIds?.[0] || defaultChannelId;
  
  const { data: timeline, isLoading: isTimelineLoading, error: timelineError } = useTimeline(channelId);
  const { sendMessage, isPending: isSending, error: sendError } = useSendMessage(channelId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (reconnectAttempts > 2) {
    return (
      <ChatLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md px-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-adonis text-lg mb-2">Reconnecting to Towns...</p>
            <p className="font-georgia-pro text-sm text-gray-600">
              Attempt {reconnectAttempts} of 5
            </p>
            {reconnectAttempts > 3 && (
              <p className="font-georgia-pro text-xs text-gray-500 mt-2">
                If this continues, the page will refresh automatically.
              </p>
            )}
          </div>
        </div>
      </ChatLayout>
    );
  }

  useEffect(() => {
    console.log('🔐 Admin Check:', {
      currentAddress: activeAccount?.address,
      masterAdmin: process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET,
      isMatch: activeAccount?.address?.toLowerCase() === process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET?.toLowerCase(),
    });
  }, [activeAccount?.address]);

  useEffect(() => {
    async function detectRole() {
      if (activeAccount?.address) {
        const roleInfo = await getUserRole(activeAccount.address);
        setUserRole(roleInfo.role);
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
        
        if (data.success && data.data.length > 0) {
          const liveEvent = data.data[0];
          
          if (activeEventIdRef.current !== liveEvent.id) {
            activeEventIdRef.current = liveEvent.id;
            setActiveEvent(liveEvent);
            
            dailyTokenRef.current = null;
            setDailyToken(null);
          }
          
          if (liveEvent.videoEnabled && 
              liveEvent.dailyRoomName && 
              activeAccount?.address && 
              !dailyTokenRef.current) {
            
            const isHost = activeAccount.address.toLowerCase() === liveEvent.host?.id?.toLowerCase();
            
            const tokenRes = await fetch('/api/events/generate-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomName: liveEvent.dailyRoomName,
                walletAddress: activeAccount.address,
                isHost: isHost,
              }),
            });
            
            const tokenData = await tokenRes.json();
            if (tokenData.success && tokenData.data.token !== dailyTokenRef.current) {
              dailyTokenRef.current = tokenData.data.token;
              setDailyToken(tokenData.data.token);
            }
          }
        } else {
          if (activeEventIdRef.current !== null) {
            activeEventIdRef.current = null;
            dailyTokenRef.current = null;
            setActiveEvent(null);
            setDailyToken(null);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching live event:', error);
      }
    }
    
    fetchLiveEvent();
    
    const interval = setInterval(fetchLiveEvent, 30000);
    
    const supabase = createSupabaseClient();
    const channel = supabase
      .channel('chat_live_events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_events',
        },
        (payload) => {
          fetchLiveEvent();
        }
      )
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [activeAccount?.address]);

  useEffect(() => {
    if (sendError?.message?.includes('BAD_PREV_MINIBLOCK_HASH') && retryCount < 3) {
      console.log(`⚠️ Miniblock hash error, will retry in 2 seconds (attempt ${retryCount + 1}/3)`);
      recordSyncError();
      const timer = setTimeout(() => {
        setRetryCount(retryCount + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sendError, retryCount]);

  // ✅ DIAGNOSTIC LOGGING
  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 ENCRYPTION & ENTITLEMENT DEBUG:');
    console.log('   Current user:', activeAccount?.address);
    console.log('   User role:', userRole);
    console.log('   Timeline total events:', timeline?.length || 0);
    
    if (timeline && timeline.length > 0) {
      const eventsByType: Record<string, number> = {};
      timeline.forEach((e: any) => {
        const kind = e.content?.kind || e.kind || 'unknown';
        eventsByType[kind] = (eventsByType[kind] || 0) + 1;
      });
      
      console.log('   📊 Events by type:', eventsByType);
      
      const messageEvents = timeline.filter(
        (e: any) => e.content?.kind === RiverTimelineEvent.ChannelMessage
      );
      console.log('   Message events (ChannelMessage):', messageEvents.length);
      
      if (messageEvents.length > 0) {
        console.log('   📨 ChannelMessage details:');
        messageEvents.forEach((event: any, index: number) => {
          console.log(`      Message ${index + 1}:`, {
            content: event.content?.body,
            senderFull: event.sender?.id || event.creatorUserId,
            eventId: event.eventId?.substring(0, 16),
          });
        });
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }, [timeline, userRole, activeAccount?.address]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline, optimisticMessages]);

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

    const messageContent = messageInput;
    
    const tempId = addOptimisticMessage(
      messageContent,
      currentUser.displayName || currentUser.address
    );
    
    setMessageInput('');

    try {
      console.log('📤 Sending message:', messageContent);
      setRetryCount(0);
      
      await sendMessage(messageContent);
      
      console.log('✅ Message sent successfully');
      
      markMessageSent(tempId);
    } catch (error: any) {
      console.error('❌ Failed to send message:', error);
      
      markMessageFailed(tempId);
      
      setMessageInput(messageContent);
      
      if (error.message?.includes('BAD_PREV_MINIBLOCK_HASH')) {
        recordSyncError();
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
    
    setIsUploading(true);
    try {
      const ipfsUri = await uploadToIPFS(file);
      
      const fileMessage = `[FILE:${file.name}](${ipfsUri})`;
      await sendMessage(fileMessage);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('File upload failed:', error);
      alert(error.message || 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // ✅ CREATE MESSAGES ARRAY
  const messages = useMemo(() => {
    const timelineMessages = timeline
      ?.filter((event: any) => event.content?.kind === RiverTimelineEvent.ChannelMessage)
      .map((event: any) => {
        const senderId = event.sender?.id || event.creatorUserId || '';
        
        return {
          id: event.eventId || event.id,
          content: event.content?.body || '',
          sender: {
            id: senderId,
            name: event.creatorDisplayName || 'Anonymous',
            avatar: undefined,
          },
          timestamp: event.createdAtEpochMs || event.timestamp || Date.now(),
          isOwn: senderId && activeAccount?.address 
            ? senderId.toLowerCase() === activeAccount.address.toLowerCase() 
            : false,
        };
      }) || [];

    return [
      ...timelineMessages,
      ...optimisticMessages,
    ].sort((a, b) => a.timestamp - b.timestamp);
  }, [timeline, optimisticMessages, activeAccount?.address]);

  const videoStageProps = useMemo(() => {
    if (!activeEvent?.dailyRoomUrl || !dailyToken || !activeAccount?.address) {
      return null;
    }
    
    return {
      event: activeEvent,
      currentUserAddress: activeAccount.address,
      roomUrl: activeEvent.dailyRoomUrl,
      token: dailyToken,
    };
  }, [activeEvent?.id, activeEvent?.dailyRoomUrl, dailyToken, activeAccount?.address]);

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

  console.log('🎨 Rendering with messages:', messages.length);

  return (
    <>
      <DailyProvider>
        <ChatLayout>
          <div className="h-full flex flex-col bg-white">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <div className="flex items-center justify-between">
                <p className="font-georgia-pro text-sm text-gray-600">
                  <strong>{space?.metadata?.name || 'Knead Space'}</strong>
                  {channelId && ` → ${channelId.substring(0, 8)}...`}
                </p>
                <span className={`text-xs px-2 py-1 rounded-full font-georgia-pro ${
                  userRole === 'contributor' 
                    ? 'bg-purple-100 text-purple-800' 
                    : userRole === 'participant' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-800'
                }`}>
                  {userRole === 'contributor' && '⭐ Contributor'}
                  {userRole === 'participant' && '💬 Participant'}
                  {userRole === 'freemium' && '👀 Freemium'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-16">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500 py-8">
                    <p className="font-georgia-pro text-lg">No messages yet.</p>
                    <p className="font-georgia-pro text-sm mt-2">Be the first to start the conversation!</p>
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  {messages.map((message: any) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.isOwn || false}
                      streamId={channelId}
                      canAwardTokens={canAwardTokens}
                      isAdmin={activeAccount?.address?.toLowerCase() === process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET?.toLowerCase()}
                      eventId={activeEvent?.id}
                      channelId={channelId}
                      spaceId={spaceId}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-4 bg-white">
              <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.txt,.doc,.docx,.mp4,.mov"
                />
                
                {canAwardTokens && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isSending || !permissions?.canPost}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    title="Upload file"
                  >
                    📎
                  </button>
                )}
                
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    isUploading
                      ? "Uploading file..."
                      : !permissions?.canPost && userRole === 'participant'
                      ? "💬 Messaging available during live events only"
                      : !permissions?.canPost && userRole === 'freemium'
                      ? "🔒 Upgrade to Premium to participate in events"
                      : channelId 
                        ? "iMessage" 
                        : "Loading..."
                  }
                  className={`flex-1 px-4 py-3 border rounded-full focus:outline-none focus:ring-2 font-georgia-pro ${
                    permissions?.canPost 
                      ? 'focus:ring-[#007AFF] border-gray-300' 
                      : 'bg-gray-100 border-gray-200 cursor-not-allowed'
                  }`}
                  disabled={!permissions?.canPost || isSending || isUploading || !channelId}
                />
                <button 
                  type="submit" 
                  disabled={!permissions?.canPost || !messageInput.trim() || isSending || isUploading || !channelId} 
                  className="w-10 h-10 flex items-center justify-center bg-[#007AFF] text-white rounded-full hover:bg-[#0051D5] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="currentColor" 
                    className="w-5 h-5"
                  >
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </ChatLayout>
      </DailyProvider>
      
      <FreemiumBanner remainingMinutes={remainingMinutes} />
    </>
  );
}
