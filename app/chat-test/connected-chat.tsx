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
        console.log('🔍 [ConnectedChat] Fetching live events...');
        const res = await fetch('/api/events?status=live', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await res.json();
        
        console.log('�� [ConnectedChat] Live events response:', data);
        
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

  // ✅ ENHANCED: ENCRYPTION & ENTITLEMENT DIAGNOSTIC
  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 ENCRYPTION & ENTITLEMENT DEBUG:');
    console.log('   Current user:', activeAccount?.address);
    console.log('   User role:', userRole);
    console.log('   Can award tokens:', canAwardTokens);
    console.log('   Permissions:', permissions);
    console.log('   Is freemium:', isFreemiumUser);
    console.log('   Has time left:', hasTimeLeft);
    console.log('   Timeline total events:', timeline?.length || 0);
    
    if (timeline && timeline.length > 0) {
      // ✅ Show ALL event types
      const eventsByType: Record<string, number> = {};
      timeline.forEach((e: any) => {
        const kind = e.content?.kind || e.kind || 'unknown';
        eventsByType[kind] = (eventsByType[kind] || 0) + 1;
      });
      
      console.log('   📊 Events by type:', eventsByType);
      console.log('   📋 All timeline events (full details):');
      timeline.forEach((event: any, index: number) => {
        console.log(`      Event ${index + 1}:`, {
          eventId: event.eventId?.substring(0, 16),
          kind: event.content?.kind || event.kind,
          sender: event.sender?.id?.substring(0, 16) || event.creatorUserId?.substring(0, 16),
          body: event.content?.body?.substring(0, 50),
          encrypted: event.encrypted,
          error: event.error,
          decryptionFailed: event.decryptionFailed,
          fullEvent: event, // ✅ Show full object for inspection
        });
      });
      
      const messageEvents = timeline.filter(
        (e: any) => e.content?.kind === RiverTimelineEvent.ChannelMessage
      );
      console.log('   Message events (ChannelMessage):', messageEvents.length);
      
      const errorEvents = timeline.filter((e: any) => 
        e.error || 
        e.decryptionFailed || 
        e.decryptionError ||
        (e.content && e.content.error)
      );
      
      if (errorEvents.length > 0) {
        console.log('   ❌ EVENTS WITH ERRORS:', errorEvents.length);
        errorEvents.forEach((e: any, i: number) => {
          console.log(`      Error ${i + 1}:`, {
            eventId: e.eventId,
            error: e.error,
            decryptionFailed: e.decryptionFailed,
            decryptionError: e.decryptionError,
            contentError: e.content?.error,
            fullEvent: e,
          });
        });
      } else {
        console.log('   ✅ No decryption errors detected');
      }
      
      if (messageEvents.length > 0) {
        console.log('   📨 ChannelMessage details:');
        messageEvents.forEach((event: any, index: number) => {
          console.log(`      Message ${index + 1}:`, {
            eventId: event.eventId?.substring(0, 16),
            sender: event.sender?.id?.substring(0, 16) || event.creatorUserId?.substring(0, 16) || 'unknown',
            senderFull: event.sender?.id || event.creatorUserId,
            content: event.content?.body,
            kind: event.content?.kind,
            encrypted: event.encrypted,
            hasSessionKey: !!event.sessionKey,
          });
        });
      }
      
      const allSenders = new Set(
        messageEvents.map((e: any) => 
          e.sender?.id || e.creatorUserId || 'unknown'
        )
      );
      console.log('   Unique senders in timeline:', allSenders.size);
      console.log('   Sender addresses (full):', Array.from(allSenders));
      
      const currentUserMessages = messageEvents.filter((e: any) => {
        const senderId = e.sender?.id || e.creatorUserId;
        return senderId && activeAccount?.address && 
               senderId.toLowerCase() === activeAccount.address.toLowerCase();
      });
      
      if (currentUserMessages.length === messageEvents.length && messageEvents.length > 0) {
        console.log('   ⚠️  WARNING: You only see your own messages!');
        console.log('   ⚠️  This suggests an entitlement/encryption key issue');
      } else if (messageEvents.length > 0) {
        console.log('   ✅ You can see messages from other users');
        console.log(`   📊 Your messages: ${currentUserMessages.length} / Total: ${messageEvents.length}`);
      }
    } else {
      console.log('   ℹ️  No timeline events yet');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }, [timeline, userRole, canAwardTokens, permissions, activeAccount?.address, isFreemiumUser, hasTimeLeft]);

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
      console.warn('Cannot send message:', { 
        hasInput: !!messageInput.trim(), 
        isSending, 
        hasChannelId: !!channelId 
      });
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
          {/* ... rest of your existing render code - no changes needed ... */}
          {videoStageProps && activeEvent?.videoEnabled ? (
            <>
              {/* Your existing video stage code */}
            </>
          ) : (
            <>
              {/* Your existing non-video code */}
            </>
          )}
        </ChatLayout>
      </DailyProvider>
      
      <FreemiumBanner remainingMinutes={remainingMinutes} />
    </>
  );
}
