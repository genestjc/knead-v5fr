'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  useAgentConnection, 
  useSpace, 
  useSendMessage, 
  useTimeline,
  useScrollback
} from '@towns-protocol/react-sdk';
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
  const [userRole, setUserRole] = useState<'freemium' | 'participant' | 'contributor'>('freemium');
  const [isUploading, setIsUploading] = useState(false);
  const [contributorProfiles, setContributorProfiles] = useState<Record<string, any>>({});
  
  const activeEventIdRef = useRef<string | null>(null);
  const dailyTokenRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const activeAccount = useActiveAccount();

  const { isFreemiumUser, remainingMinutes, hasTimeLeft } = useFreemiumChatTimer(activeAccount?.address || null);
  const { canAwardTokens } = useContributorPermissions(activeAccount?.address);
  const { permissions } = useChatPermissions(activeAccount?.address || null);

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
  const { scrollback, isPending: isScrollingBack, data: scrollbackData } = useScrollback(channelId);

  // Detect user role
  useEffect(() => {
    async function detectRole() {
      if (activeAccount?.address) {
        const roleInfo = await getUserRole(activeAccount.address);
        setUserRole(roleInfo.role);
      }
    }
    detectRole();
  }, [activeAccount?.address]);

  // Fetch live event
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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_events',
      }, () => fetchLiveEvent())
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [activeAccount?.address]);

  // Fetch contributor profiles
  useEffect(() => {
    if (!timeline) return;
    
    const senderAddresses = new Set(
      timeline
        .filter((e: any) => e.content?.kind === RiverTimelineEvent.ChannelMessage)
        .map((e: any) => e.sender?.id || e.creatorUserId)
        .filter(Boolean)
    );
    
    senderAddresses.forEach((address) => {
      if (contributorProfiles[address]) return;
      
      fetch(`/api/chat/user?address=${address}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            setContributorProfiles(prev => ({
              ...prev,
              [address]: {
                alias: data.user.alias || data.user.displayName,
                avatar: data.user.avatar,
              }
            }));
          }
        })
        .catch(error => console.error('Failed to fetch profile for', address, error));
    });
  }, [timeline]);

  // Auto-scroll to bottom
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
    
    if (!messageInput.trim() || isSending || !channelId) return;

    const messageContent = messageInput;
    const tempId = addOptimisticMessage(messageContent, currentUser.displayName || currentUser.address);
    setMessageInput('');

    try {
      await sendMessage(messageContent);
      markMessageSent(tempId);
    } catch (error: any) {
      console.error('❌ Failed to send message:', error);
      markMessageFailed(tempId);
      setMessageInput(messageContent);
      
      if (!error.message?.includes('already a member')) {
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

  // Process messages
  const messages = useMemo(() => {
    const timelineMessages = timeline
      ?.filter((event: any) => event.content?.kind === RiverTimelineEvent.ChannelMessage)
      .map((event: any) => {
        const senderId = event.sender?.id || event.creatorUserId || '';
        const profile = contributorProfiles[senderId];
        
        return {
          id: event.eventId || event.id,
          content: event.content?.body || '',
          sender: {
            id: senderId,
            name: profile?.alias || `${senderId.substring(0, 6)}...${senderId.substring(senderId.length - 4)}`,
            avatar: profile?.avatar,
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
  }, [timeline, optimisticMessages, activeAccount?.address, contributorProfiles]);

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

  return (
    <>
      <DailyProvider>
        <ChatLayout>
          <div className="flex flex-col h-full">
            {/* Video Stage */}
            {videoStageProps && (
              <EventVideoStage {...videoStageProps} />
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  canAwardTokens={canAwardTokens}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={userRole === 'freemium' ? 'Upgrade to send messages...' : 'Type a message...'}
                  disabled={isSending || userRole === 'freemium'}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isSending || !messageInput.trim() || userRole === 'freemium'}
                  className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {isSending ? 'Sending...' : 'Send'}
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
