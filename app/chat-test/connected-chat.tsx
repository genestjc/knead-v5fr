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
import { FileMessageDisplay } from '@/components/chat/FileMessageDisplay';
import type { ChatUser, ChatEvent } from '@/types/chat';
import { useActiveAccount } from 'thirdweb/react';
import { useFreemiumChatTimer } from '@/hooks/use-freemium-chat-timer';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { useChatPermissions } from '@/hooks/use-chat-permissions';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { uploadToIPFS } from '@/lib/thirdweb/storage';
import { useTownsConnectionMonitor } from '@/hooks/use-towns-connection';
import { trackUserState, recordSyncError } from '@/lib/towns/cache-manager';
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

  // ✅ NEW: Monitor Towns connection health
  const { isConnected, reconnectAttempts } = useTownsConnectionMonitor();

  // ✅ NEW: Optimistic message updates
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

  // ✅ NEW: Track user state changes and clear cache if needed
  useEffect(() => {
    if (activeAccount?.address && userRole) {
      const cacheCleared = trackUserState(userRole, canAwardTokens);
      
      if (cacheCleared) {
        console.log('🔄 User state changed - reloading in 2 seconds...');
        setTimeout(() => window.location.reload(), 2000);
      }
    }
  }, [userRole, canAwardTokens, activeAccount?.address]);

  // ✅ NEW: Show connection status if having issues
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

  // ... (event fetching useEffect stays the same) ...

  useEffect(() => {
    async function fetchLiveEvent() {
      try {
        console.log('🔍 [ConnectedChat] Fetching live events...');
        const res = await fetch('/api/events?status=live', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await res.json();
        
        console.log('📊 [ConnectedChat] Live events response:', data);
        
        if (data.success && data.data.length > 0) {
          const liveEvent = data.data[0];
          
          if (activeEventIdRef.current !== liveEvent.id) {
            console.log('🎥 [ConnectedChat] NEW event detected:', liveEvent.title);
            activeEventIdRef.current = liveEvent.id;
            setActiveEvent(liveEvent);
            
            dailyTokenRef.current = null;
            setDailyToken(null);
          } else {
            console.log('⏭️ [ConnectedChat] Same event, skipping update');
          }
          
          if (liveEvent.videoEnabled && 
              liveEvent.dailyRoomName && 
              activeAccount?.address && 
              !dailyTokenRef.current) {
            
            const isHost = activeAccount.address.toLowerCase() === liveEvent.host?.id?.toLowerCase();
            
            console.log('🎫 [ConnectedChat] Generating Daily token...');
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
              console.log('✅ [ConnectedChat] New Daily token generated');
              dailyTokenRef.current = tokenData.data.token;
              setDailyToken(tokenData.data.token);
            }
          }
        } else {
          if (activeEventIdRef.current !== null) {
            console.log('📭 [ConnectedChat] No live events - clearing');
            activeEventIdRef.current = null;
            dailyTokenRef.current = null;
            setActiveEvent(null);
            setDailyToken(null);
          }
        }
      } catch (error) {
        console.error('❌ [ConnectedChat] Error fetching live event:', error);
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
          console.log('🔄 [ConnectedChat] Event changed:', payload);
          fetchLiveEvent();
        }
      )
      .subscribe((status) => {
        console.log('📡 [ConnectedChat] Event subscription:', status);
      });
    
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline, optimisticMessages]);

  // ✅ UPDATED: Handle send message with optimistic updates
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
      console.warn('Cannot send message:', { 
        hasInput: !!messageInput.trim(), 
        isSending, 
        hasChannelId: !!channelId 
      });
      return;
    }

    const messageContent = messageInput;
    
    // ✅ Show message immediately (optimistic update)
    const tempId = addOptimisticMessage(
      messageContent,
      currentUser.displayName || currentUser.address
    );
    
    // Clear input immediately
    setMessageInput('');

    try {
      console.log('📤 Sending message:', messageContent);
      setRetryCount(0);
      
      await sendMessage(messageContent);
      
      console.log('✅ Message sent successfully');
      
      // Mark optimistic message as sent
      markMessageSent(tempId);
    } catch (error: any) {
      console.error('❌ Failed to send message:', error);
      
      // Mark optimistic message as failed
      markMessageFailed(tempId);
      
      // Restore input so user can retry
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

  // ✅ UPDATED: Combine real + optimistic messages
  const messages = [
    ...(timeline
      ?.filter((event: any) => event.content?.kind === RiverTimelineEvent.ChannelMessage)
      .map((event: any) => {
        const senderId = event.sender?.id || '';
        
        if (!senderId) {
          console.warn('⚠️ No sender ID found for event:', event.eventId);
        }

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
      }) || []),
    // ✅ Add optimistic messages
    ...optimisticMessages,
  ].sort((a, b) => a.timestamp - b.timestamp);

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
          {videoStageProps && activeEvent?.videoEnabled ? (
            <>
              {/* Desktop/Tablet: Horizontal split */}
              <div className="hidden lg:grid lg:grid-rows-2 h-screen">
                <div className="border-b border-gray-200">
                  <EventVideoStage {...videoStageProps} />
                </div>
                
                <div className="flex flex-col overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <div className="flex items-center justify-between">
                      <p className="font-georgia-pro text-sm text-gray-600">
                        <strong>{space?.metadata?.name || 'Knead Space'}</strong>
                        {channelId && ` → Channel: ${channelId.substring(0, 8)}...`}
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
                            isAdmin={activeAccount?.address.toLowerCase() === process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET?.toLowerCase()}
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
                        title={
                          !permissions?.canPost && userRole === 'participant'
                            ? "Messaging available during live events only"
                            : ""
                        }
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
              </div>

              {/* Mobile: Vertical 3-section split */}
              <div className="lg:hidden flex flex-col h-screen">
                <div className="h-1/3 border-b border-gray-200">
                  <EventVideoStage {...videoStageProps} />
                </div>
                
                <div className="h-2/3 flex flex-col overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <div className="flex items-center justify-between">
                      <p className="font-georgia-pro text-sm text-gray-600">
                        <strong>{space?.metadata?.name || 'Knead Space'}</strong>
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
                    {isTimelineLoading ? (
                      <LoadingSpinner />
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-gray-500 py-8">
                          <p className="font-georgia-pro text-sm">No messages yet.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 px-2">
                        {messages.map((message: any) => (
                          <MessageBubble
                            key={message.id}
                            message={message}
                            isOwn={message.isOwn || false}
                            streamId={channelId}
                            canAwardTokens={canAwardTokens}
                            isAdmin={activeAccount?.address.toLowerCase() === process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET?.toLowerCase()}
                            eventId={activeEvent?.id}
                            channelId={channelId}
                            spaceId={spaceId}
                          />
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 p-2 bg-white">
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
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 text-sm"
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
                            ? "Uploading..."
                            : !permissions?.canPost && userRole === 'participant'
                            ? "💬 Live events only"
                            : !permissions?.canPost && userRole === 'freemium'
                            ? "🔒 Upgrade to Premium"
                            : "Message"
                        }
                        className={`flex-1 px-3 py-2 border rounded-full focus:outline-none focus:ring-2 font-georgia-pro text-sm ${
                          permissions?.canPost 
                            ? 'focus:ring-[#007AFF] border-gray-300' 
                            : 'bg-gray-100 border-gray-200 cursor-not-allowed'
                        }`}
                        disabled={!permissions?.canPost || isSending || isUploading || !channelId}
                      />
                      <button 
                        type="submit" 
                        disabled={!permissions?.canPost || !messageInput.trim() || isSending || isUploading || !channelId} 
                        className="w-8 h-8 flex items-center justify-center bg-[#007AFF] text-white rounded-full hover:bg-[#0051D5] transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 24 24" 
                          fill="currentColor" 
                          className="w-4 h-4"
                        >
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
                    {channelId && ` → Channel: ${channelId.substring(0, 8)}...`}
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

              {permissions?.canPost && userRole === 'participant' && (
                <div className="bg-green-50 border-b border-green-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">🎙️</span>
                    <p className="text-sm text-green-800 font-medium">
                      Event is live! You can now ask questions and participate.
                    </p>
                  </div>
                </div>
              )}

              {activeEvent && (
                <EventBanner
                  eventTitle={activeEvent.title}
                  timeRemaining={undefined}
                  isLive={true}
                />
              )}

              <div className="flex-1 overflow-y-auto pb-16">
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
                        isAdmin={activeAccount?.address.toLowerCase() === process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET?.toLowerCase()}
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
                    title={
                      !permissions?.canPost && userRole === 'participant'
                        ? "Messaging available during live events only"
                        : ""
                    }
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
          )}
        </ChatLayout>
      </DailyProvider>
      
      <FreemiumBanner remainingMinutes={remainingMinutes} />
    </>
  );
}
