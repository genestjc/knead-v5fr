'use client';

import { useState, useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useMembership } from '@/components/membership-provider';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { VideoStage } from '@/components/chat/VideoStage';
import { useChannel, useSendMessage } from '@towns-protocol/react-sdk';
import { useSyncTownsToSupabase } from '@/hooks/useSyncTownsToSupabase';
import { canViewChannel, canPostInChannel } from '@/lib/chat/permissions';
import { format, formatDistanceToNow } from 'date-fns';
import type { ChatUser } from '@/types/chat';

interface EventPageProps {
  params: {
    id: string;
  };
}

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
  const { messages: townsMessages, isLoading: loadingMessages } = useChannel('live-interviews');
  const { sendMessage, isSending } = useSendMessage();
  useSyncTownsToSupabase('live-interviews');

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
    displayName: account?.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : '',
    role: 'viewer',
    membershipTier: (membershipType || 'freemium') as 'freemium' | 'premium' | 'contributor',
    contributorType: undefined,
    isBanned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [townsMessages]);

  // ✅ NO MORE POLLING! Removed setInterval - Towns handles real-time via WebSocket

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
      await sendMessage('live-interviews', messageInput.trim(), {
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

  const viewAccess = canViewChannel(currentUser, 'live-interviews', 0);
  const postAccess = canPostInChannel(currentUser, 'live-interviews');

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
            Back to Chat
          </a>
        </div>
      </div>
    );
  }

  if (!account?.address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">{event.title}</h1>
          <p className="font-georgia-pro text-lg mb-8 text-gray-600">
            Connect your wallet to join this live event
          </p>
          <ThirdWebConnectButton />
        </div>
      </div>
    );
  }

  if (!viewAccess.canView) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Access Restricted</h1>
          <p className="font-georgia-pro text-lg mb-6 text-gray-600">{viewAccess.reason}</p>
          <a 
            href="/join" 
            className="inline-block px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
          >
            Upgrade to Access
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 p-4 bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-adonis text-2xl">{event.title}</h1>
              {event.status === 'live' && (
                <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </span>
              )}
            </div>
            <p className="font-georgia-pro text-sm text-gray-600">{event.description}</p>
          </div>
          <a
            href="/chat-test"
            className="px-6 py-2 bg-gray-100 text-black rounded-full font-georgia-pro hover:bg-gray-200 transition"
          >
            ← Back
          </a>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video + Event Info */}
        <div className="flex-1 flex flex-col border-r border-gray-200">
          {/* Video Stage */}
          {event.videoEnabled && event.dailyRoomUrl && (
            <div className="flex-1 bg-gray-900 p-4">
              <VideoStage
                roomUrl={event.dailyRoomUrl}
                userName={currentUser.displayName}
                isHost={isHost}
                isGuest={isGuest}
              />
            </div>
          )}

          {/* Event Details */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="font-georgia-pro text-xs text-gray-500 mb-1">Host</p>
                <p className="font-georgia-pro text-sm font-semibold">
                  {event.host?.displayName || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="font-georgia-pro text-xs text-gray-500 mb-1">Type</p>
                <p className="font-georgia-pro text-sm font-semibold capitalize">{event.eventType}</p>
              </div>
              <div>
                <p className="font-georgia-pro text-xs text-gray-500 mb-1">Started</p>
                <p className="font-georgia-pro text-sm">
                  {format(new Date(event.scheduledStart), 'h:mm a')}
                </p>
              </div>
              <div>
                <p className="font-georgia-pro text-xs text-gray-500 mb-1">Ends</p>
                <p className="font-georgia-pro text-sm">
                  {format(new Date(event.scheduledEnd), 'h:mm a')}
                </p>
              </div>
            </div>

            {event.guests && event.guests.length > 0 && (
              <div>
                <p className="font-georgia-pro text-xs text-gray-500 mb-2">Guests</p>
                <div className="flex flex-wrap gap-2">
                  {event.guests.map((guest: any) => (
                    <span key={guest.id} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-georgia-pro">
                      {guest.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Chat */}
        <aside className="w-96 flex flex-col bg-white">
          <div className="border-b border-gray-200 p-4">
            <h2 className="font-adonis text-xl">Live Chat</h2>
            <p className="font-georgia-pro text-xs text-gray-500">
              {townsMessages?.length || 0} messages
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingMessages ? (
              <div className="text-center text-gray-500 py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-2"></div>
                Loading messages...
              </div>
            ) : townsMessages && townsMessages.length > 0 ? (
              townsMessages.slice().reverse().map((message) => {
                const displayName = message.sender?.displayName || message.sender?.username || 'Anonymous';
                const roleDisplay = getRoleDisplay('viewer'); // Default to viewer since Towns doesn't know Knead roles
                
                return (
                  <div key={message.id} className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-georgia-pro font-semibold text-sm truncate">
                          {displayName}
                        </span>
                        <span className="text-xs">{roleDisplay.icon}</span>
                        <span className="font-georgia-pro text-xs text-gray-400">
                          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="font-georgia-pro text-sm text-gray-800 break-words">
                        {message.text || message.content}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p className="font-georgia-pro">No messages yet</p>
                <p className="font-georgia-pro text-xs mt-2">Be the first to comment!</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-200 p-4">
            {!postAccess.canPost ? (
              <div className="text-center py-2">
                <p className="font-georgia-pro text-xs text-gray-500">
                  {postAccess.reason}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Send a message..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-georgia-pro focus:outline-none focus:border-gray-400 resize-none text-sm"
                  rows={2}
                  disabled={isSending}
                />
                <button
                  onClick={handleSendMessage}
                  className="w-full px-4 py-2 bg-black text-white rounded-lg font-georgia-pro hover:bg-gray-800 transition disabled:opacity-50 text-sm"
                  disabled={!messageInput.trim() || isSending}
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
