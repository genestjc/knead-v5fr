'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from 'react';
import { useAgentConnection, useSpace, useSendMessage, useTimeline } from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { MessageBubble, EventBanner } from '@/components/chat/MessageBubble';
import { FreemiumBanner } from '@/components/chat/FreemiumBanner';
import type { ChatUser } from '@/types/chat';
import { useActiveAccount } from 'thirdweb/react';
import { useFreemiumChatTimer } from '@/hooks/use-freemium-chat-timer';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';

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

// ✅ Wrapper component that checks if agent is connected
export default function ConnectedChat(props: ConnectedChatProps) {
  const { isAgentConnected } = useAgentConnection();
  
  // Don't render the inner component until agent is connected
  if (!isAgentConnected) {
    return (
      <ChatLayout>
        <LoadingSpinner />
      </ChatLayout>
    );
  }
  
  return <ConnectedChatInner {...props} />;
}

// ✅ Inner component that uses Towns hooks (only renders when agent is connected)
function ConnectedChatInner({ currentUser, spaceId, defaultChannelId }: ConnectedChatProps) {
  const [messageInput, setMessageInput] = useState('');
  const [activeEvent, setActiveEvent] = useState<{title: string; timeRemaining?: string} | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [userRole, setUserRole] = useState<'freemium' | 'participant' | 'contributor'>('freemium');
  
  const { isAgentConnected } = useAgentConnection();
  const activeAccount = useActiveAccount();

  // Get user role and permissions
  const { isFreemiumUser, remainingMinutes, hasTimeLeft } = useFreemiumChatTimer(activeAccount?.address || null);
  const { canAwardTokens } = useContributorPermissions(activeAccount?.address);

  const { data: space, isLoading: isSpaceLoading, error: spaceError } = useSpace(spaceId);
  
  const channelId = space?.channelIds?.[0] || defaultChannelId;
  
  const { data: timeline, isLoading: isTimelineLoading, error: timelineError } = useTimeline(channelId);
  const { sendMessage, isPending: isSending, error: sendError } = useSendMessage(channelId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Detect user role on mount and when address changes
  useEffect(() => {
    async function detectRole() {
      if (activeAccount?.address) {
        const roleInfo = await getUserRole(activeAccount.address);
        setUserRole(roleInfo.role);
      }
    }
    detectRole();
  }, [activeAccount?.address]);

  // Auto-retry on miniblock hash errors
  useEffect(() => {
    if (sendError?.message?.includes('BAD_PREV_MINIBLOCK_HASH') && retryCount < 3) {
      console.log(`⚠️ Miniblock hash error, will retry in 2 seconds (attempt ${retryCount + 1}/3)`);
      const timer = setTimeout(() => {
        setRetryCount(retryCount + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sendError, retryCount]);

  // Debug logging
  useEffect(() => {
    console.log('🔍 ConnectedChat Debug:');
    console.log('   - spaceId:', spaceId);
    console.log('   - space:', space);
    console.log('   - channelId:', channelId);
    console.log('   - timeline length:', timeline?.length);
    
    if (spaceError) console.error('❌ Space error:', spaceError);
    if (timelineError) console.error('❌ Timeline error:', timelineError);
    if (sendError) console.error('❌ Send error:', sendError);
  }, [spaceId, space, channelId, timeline, spaceError, timelineError, sendError]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Block freemium users without time left
    if (isFreemiumUser && !hasTimeLeft) {
      alert('⏱️ Your free viewing time has expired. Upgrade to Knead Monthly to continue.');
      return;
    }
    
    // Block freemium users from sending messages
    if (userRole === 'freemium') {
      alert('👀 Freemium users can only view messages. Upgrade to Knead Monthly to participate.');
      return;
    }
    
    if (!messageInput.trim() || isSending || !channelId) {
      console.warn('Cannot send message:', { 
        hasInput: !!messageInput.trim(), 
        isSending, 
        hasChannelId: !!channelId 
      });
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

  // Filter and transform timeline events properly
  const messages = timeline
    ?.filter((event: any) => event.content?.kind === RiverTimelineEvent.ChannelMessage)
    .map((event: any) => {
      return {
        id: event.eventId || event.id,
        content: event.content?.body || '',
        sender: {
          id: event.creatorUserId || '',
          name: event.creatorDisplayName || 'Anonymous',
          avatar: undefined,
        },
        timestamp: event.createdAtEpochMs || event.timestamp || Date.now(),
        isOwn: event.creatorUserId === activeAccount?.address,
      };
    }) || [];

  // Loading state
  if (isSpaceLoading || isTimelineLoading) {
    return (
      <ChatLayout>
        <LoadingSpinner />
      </ChatLayout>
    );
  }

  // Error state
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
    <ChatLayout>
      <div className="h-full flex flex-col bg-white">
        {/* Space & Channel Info */}
        <div className="bg-gray-50 px-4 py-2 border-b">
          <div className="flex items-center justify-between">
            <p className="font-georgia-pro text-sm text-gray-600">
              <strong>{space?.metadata?.name || 'Knead Space'}</strong>
              {channelId && ` → Channel: ${channelId.substring(0, 8)}...`}
            </p>
            {/* Role Badge */}
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

        {/* Freemium Timer Banner */}
        {isFreemiumUser && remainingMinutes !== null && (
          <FreemiumBanner remainingMinutes={remainingMinutes} />
        )}

        {/* Event Indicator Banner */}
        {activeEvent && (
          <EventBanner
            eventTitle={activeEvent.title}
            timeRemaining={activeEvent.timeRemaining}
            isLive={true}
          />
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {isTimelineLoading ? (
            <LoadingSpinner />
          ) : messages.length === 0 ? (
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
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area - iMessage Style */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={
                userRole === 'freemium' 
                  ? "Freemium users can only view messages..." 
                  : channelId 
                    ? "iMessage" 
                    : "Loading..."
              }
              className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#007AFF] font-georgia-pro"
              disabled={isSending || !channelId || userRole === 'freemium' || (isFreemiumUser && !hasTimeLeft)}
            />
            <button 
              type="submit" 
              disabled={isSending || !messageInput.trim() || !channelId || userRole === 'freemium' || (isFreemiumUser && !hasTimeLeft)} 
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
  );
}
