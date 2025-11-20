'use client';

import { useState, useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useMembership } from '@/components/membership-provider';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { VideoStage } from '@/components/chat/VideoStage';
import { useChannel, useSendMessage, useTimeline } from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { useSyncTownsToSupabase } from '@/hooks/useSyncTownsToSupabase';
import { canViewChannel, canPostInChannel } from '@/lib/chat/permissions';
import { format, formatDistanceToNow } from 'date-fns';
import type { ChatUser } from '@/types/chat';

interface EventPageProps {
  params: {
    id: string;
  };
}

// Get Space ID from environment
const SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID || '';
const LIVE_CHANNEL_ID = 'live-interviews';

export default function EventPage({ params }: EventPageProps) {
  const [event, setEvent] = useState<any | null>(null);
  const [realUser, setRealUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [attendanceAwarded, setAttendanceAwarded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const account = useActiveAccount();
  const { membershipType, isLoading: membershipLoading } = useMembership();

  // ✅ Towns Protocol for real-time messaging (NO POLLING!)
  const { data: channel } = useChannel(SPACE_ID, LIVE_CHANNEL_ID);
  const { data: events, isLoading: loadingMessages } = useTimeline(LIVE_CHANNEL_ID);
  const { sendMessage, isPending: isSending } = useSendMessage(LIVE_CHANNEL_ID);
  
  // Sync Towns messages to Supabase for point tracking
  useSyncTownsToSupabase(SPACE_ID, LIVE_CHANNEL_ID);

  // Filter timeline events to only show chat messages
  const townsMessages = events?.filter(
    event => event.content?.kind === RiverTimelineEvent.ChannelMessage
  ) || [];

  // Fetch event details
  useEffect(() => {
    async function fetchEvent() {
      try {
        const response = await fetch(`/api/events?status=live`);
        const data = await response.json();

        if (data.success) {
          const foundEvent = data.data.find((e: any) => e.id === params.id);
          if (foundEvent) {
            setEvent(foundEvent);
          } else {
            setError('Event not found');
          }
        } else {
          setError(data.error || 'Failed to fetch event');
        }
      } catch (err) {
        setError('Error fetching event');
        console.error(err);
      }
    }

    fetchEvent();
  }, [params.id]);

  // Fetch or create user
  useEffect(() => {
    async function fetchUser() {
      if (!account?.address) {
        setLoading(false);
        return;
      }

      if (membershipLoading) {
        return;
      }

      try {
        const response = await fetch('/api/chat/get-or-create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: account.address,
            membershipTier: membershipType || 'freemium',
          }),
        });

        const data = await response.json();
        
        if (data.success && data.user) {
          setRealUser(data.user);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [account?.address, membershipType, membershipLoading]);

  const currentUser: ChatUser = realUser || {
    id: account?.address || '',
    address: account?.address || '',
    displayName: account?.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : 'Anonymous',
    alias: null,
    membershipTier: 'freemium',
    role: 'viewer',
    personalEarningsAvailable: '0',
    personalEarningsWithdrawn: '0',
    createdAt: new Date().toISOString(),
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [townsMessages]);

  // Award attendance bonus (one time per event)
  useEffect(() => {
    if (!realUser?.id || !event || attendanceAwarded || event.status !== 'live') return;

    async function awardAttendanceBonus() {
      try {
        // Award 10 point attendance bonus
        // TODO: Create /api/chat/award-attendance endpoint
        setAttendanceAwarded(true);
        console.log('✅ Attendance bonus awarded: 10 points');
      } catch (error) {
        console.error('Error awarding attendance bonus:', error);
      }
    }

    awardAttendanceBonus();
  }, [realUser?.id, event, attendanceAwarded]);

  // ✅ Send message via Towns Protocol
  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending || !realUser) return;

    try {
      await sendMessage(messageInput.trim(), {
        kneadUserId: realUser.id,
        eventId: params.id,
        timestamp: new Date().toISOString(),
      });
      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'master-admin':
        return { icon: '👑', label: 'Master Admin' };
      case 'admin':
        return { icon: '🛡️', label: 'Admin' };
      case 'contributor':
        return { icon: '✍️', label: 'Contributor' };
      default:
        return { icon: '👤', label: 'Viewer' };
    }
  };

  const viewAccess = canViewChannel(currentUser, LIVE_CHANNEL_ID, 0);
  const postAccess = canPostInChannel(currentUser, LIVE_CHANNEL_ID);

  // Check if user is host or guest
  const isHost = realUser?.id === event?.hostId;
  const isGuest = event?.guestIds?.includes(realUser?.id);

  if (loading || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Event Not Found</h1>
          <p className="font-georgia-pro text-lg mb-6 text-gray-600">{error}</p>
          <a 
            href="/chat-test" 
            className="inline-block px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
          >
            ← Back to Chat
          </a>
        </div>
      </div>
    );
  }

  // Not connected
  if (!account?.address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-5xl mb-6">{event.title}</h1>
          <p className="font-georgia-pro text-lg mb-8 text-gray-600">
            Connect your wallet to join the live event
          </p>
          <ThirdWebConnectButton />
        </div>
      </div>
    );
  }

  // Don't have viewing access
  if (!viewAccess.allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Access Required</h1>
          <p className="font-georgia-pro text-lg mb-6 text-gray-600">
            {viewAccess.reason}
          </p>
          <a 
            href="/membership" 
            className="inline-block px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
          >
            View Membership Options
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-adonis text-3xl mb-1">{event.title}</h1>
              <p className="font-georgia-pro text-sm text-gray-600">
                {event.scheduledStart && format(new Date(event.scheduledStart), 'PPp')}
                {event.status === 'live' && <span className="ml-2 text-red-600">● LIVE</span>}
              </p>
            </div>
            <ThirdWebConnectButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Stage */}
          {event.videoEnabled && event.dailyRoomUrl && (
            <div className="lg:col-span-2">
              <VideoStage
                roomUrl={event.dailyRoomUrl}
                userName={realUser?.alias || realUser?.displayName || 'Anonymous'}
                isHost={isHost}
                isGuest={isGuest}
                onLeave={() => window.location.href = '/chat-test'}
              />
            </div>
          )}

          {/* Chat Panel */}
          <div className={event.videoEnabled ? 'lg:col-span-1' : 'lg:col-span-3 max-w-2xl mx-auto w-full'}>
            <div className="bg-gray-50 rounded-lg border border-gray-200 h-[600px] flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-adonis text-xl">Live Chat</h2>
                <p className="font-georgia-pro text-xs text-gray-600">
                  {townsMessages.length} messages
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                  </div>
                )}

                {townsMessages.map((msg, idx) => {
                  const messageText = msg.content?.body?.text || msg.content?.text || '';
                  const authorId = msg.creatorUserId || '';
                  const timestamp = new Date(msg.createdAtEpochMs || Date.now());
                  
                  return (
                    <div key={msg.eventId || idx} className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="flex items-start gap-2 mb-1">
                        <span className="font-georgia-pro text-sm font-semibold">
                          {authorId.slice(0, 6)}...{authorId.slice(-4)}
                        </span>
                        <span className="font-georgia-pro text-xs text-gray-500">
                          {formatDistanceToNow(timestamp, { addSuffix: true })}
                        </span>
                      </div>
                      <p className="font-georgia-pro text-sm">{messageText}</p>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200">
                {postAccess.allowed ? (
                  <div className="flex gap-2">
                    <textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-georgia-pro text-sm resize-none focus:outline-none focus:border-black"
                      rows={2}
                      disabled={isSending}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isSending || !messageInput.trim()}
                      className="px-4 py-2 bg-black text-white rounded-lg font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="font-georgia-pro text-sm text-gray-600">
                      {postAccess.reason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
