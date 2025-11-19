"use client";

import { useState, useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useMembership } from '@/components/membership-provider';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { KNEAD_CHANNELS } from '@/lib/chat/config';
import { canViewChannel, canPostInChannel, canAwardLikes } from '@/lib/chat/permissions';
import { useChat } from '@/hooks/useChat';
import type { ChatUser, ChatMessage } from '@/types/chat';
import { formatDistanceToNow } from 'date-fns';

export default function ChatTestPage() {
  const [selectedChannel, setSelectedChannel] = useState('main');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [realUser, setRealUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const account = useActiveAccount();
  const { membershipType, isLoading: membershipLoading } = useMembership();

  // Fetch or create real user from database
  useEffect(() => {
    async function fetchUser() {
      if (!account?.address) {
        setLoading(false);
        return;
      }

      // Wait for membership to load first
      if (membershipLoading) {
        return;
      }

      try {
        console.log('🔄 Fetching/creating user for:', account.address);
        console.log('📊 Membership Type:', membershipType);

        const response = await fetch('/api/chat/get-or-create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: account.address,
            membershipTier: membershipType || 'freemium',
          }),
        });

        const data = await response.json();
        console.log('✅ User API Response:', data);
        
        if (data.success && data.user) {
          setRealUser(data.user);
          console.log('👤 Real User Loaded:', data.user);
          console.log('🔑 User Role:', data.user.role);
          console.log('💎 User Tier:', data.user.membershipTier);
        } else {
          console.error('❌ Failed to load user:', data.error);
        }
      } catch (error) {
        console.error('❌ Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [account?.address, membershipType, membershipLoading]);

  // Use real user if available, otherwise create temporary fallback
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

  // Initialize chat hook with polling
  const {
    messages,
    permissions,
    loading: chatLoading,
    error: chatError,
    sendMessage,
    awardLike,
    refetch,
  } = useChat({
    channelId: selectedChannel,
    userId: realUser?.id,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!realUser?.id) return;
    
    const interval = setInterval(() => {
      refetch();
    }, 3000);

    return () => clearInterval(interval);
  }, [realUser?.id, refetch]);

  // Debug logs
  console.log('=== CHAT TEST DEBUG ===');
  console.log('Account Address:', account?.address);
  console.log('Membership Type:', membershipType);
  console.log('Real User:', realUser);
  console.log('Current User:', currentUser);
  console.log('Is Using Real User:', !!realUser);
  
  const viewAccess = canViewChannel(currentUser, selectedChannel, 0);
  console.log('View Access Result:', viewAccess);

  const postAccess = canPostInChannel(currentUser, selectedChannel);
  const likeAccess = canAwardLikes(currentUser);

  const currentChannel = KNEAD_CHANNELS.find(ch => ch.id === selectedChannel);

  // Handle message send
  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending || !realUser) return;

    setIsSending(true);
    try {
      const success = await sendMessage(messageInput.trim());
      if (success) {
        setMessageInput('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle like
  const handleLike = async (messageId: string) => {
    if (!likeAccess.canAward) return;
    await awardLike(messageId, 'insightful_response', 'discussion');
  };

  // Get role icon and label
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

  // Show loading state
  if (loading || membershipLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Not connected
  if (!account?.address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-5xl mb-6">Knead Chat</h1>
          <p className="font-georgia-pro text-lg mb-8 text-gray-600">
            Connect your wallet to access the community chat
          </p>
          <ThirdWebConnectButton />
        </div>
      </div>
    );
  }

  // Access denied
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
            Upgrade to Premium
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <header className="border-b border-gray-200 p-4 flex items-center justify-between bg-white">
        <h1 className="font-adonis text-3xl">Knead</h1>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <span className="font-georgia-pro text-sm text-gray-600 block">
              {currentUser.displayName}
            </span>
            {realUser && (
              <span className="font-georgia-pro text-xs text-gray-400 block">
                {currentUser.role === 'master-admin' ? '👑 Master Admin' : 
                 currentUser.role === 'admin' ? '🛡️ Admin' :
                 currentUser.role === 'contributor' ? '✍️ Contributor' : 
                 '👤 Viewer'}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex flex-col space-y-1.5 p-2 hover:bg-gray-50 rounded transition"
            aria-label="Menu"
          >
            <span className={`w-6 h-0.5 bg-black transition-all ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`w-6 h-0.5 bg-black transition-all ${isMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`w-6 h-0.5 bg-black transition-all ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </header>

      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
          onClick={() => setIsMenuOpen(false)}
        >
          <div 
            className="absolute right-0 top-0 h-full w-80 bg-white shadow-2xl p-8 transform transition-transform"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setIsMenuOpen(false)}
              className="absolute top-6 right-6 text-3xl text-gray-400 hover:text-black transition"
            >
              ×
            </button>
            <nav className="mt-16 space-y-6">
              <button className="font-adonis text-2xl block w-full text-left hover:text-gray-600 transition">
                Settings
              </button>
              <button className="font-adonis text-2xl block w-full text-left hover:text-gray-600 transition">
                Transfer Earnings
              </button>
              <button className="font-adonis text-2xl block w-full text-left hover:text-gray-600 transition">
                View Profile
              </button>
              <div className="border-t border-gray-200 pt-6">
                <a 
                  href="/" 
                  className="font-adonis text-2xl block w-full text-left hover:text-gray-600 transition"
                >
                  Return to Home
                </a>
              </div>
            </nav>
            
            <div className="absolute bottom-8 left-8 right-8 border-t border-gray-200 pt-6">
              <div className="font-georgia-pro text-sm text-gray-500 space-y-2">
                <div className="flex justify-between">
                  <span>Role:</span>
                  <span className="font-semibold capitalize">{currentUser.role.replace('-', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Membership:</span>
                  <span className="font-semibold capitalize">{currentUser.membershipTier}</span>
                </div>
                <div className="flex justify-between">
                  <span>User Type:</span>
                  <span className="font-semibold">{realUser ? '✅ Real' : '⚠️ Guest'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-gray-200 flex flex-col bg-gray-50">
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="font-adonis text-sm uppercase tracking-wider text-gray-500 mb-4">Channels</h2>
            <div className="space-y-1">
              {KNEAD_CHANNELS.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition font-georgia-pro flex items-center space-x-3 ${
                    selectedChannel === channel.id
                      ? 'bg-white shadow-sm text-black'
                      : 'text-gray-600 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <span className="text-xl">{channel.icon}</span>
                  <span>{channel.name}</span>
                  {channel.isOpenPeriod && (
                    <span className="ml-auto w-2 h-2 bg-green-500 rounded-full" title="Open Period Active" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 p-6 bg-white">
            <h2 className="font-adonis text-sm uppercase tracking-wider text-gray-500 mb-4">Direct Messages</h2>
            <button className="w-full text-left px-4 py-3 rounded-xl font-georgia-pro text-gray-600 hover:bg-gray-50 transition flex items-center space-x-3">
              <span className="text-xl">✉️</span>
              <span>Messages</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-white">
          <div className="border-b border-gray-200 p-6 bg-white">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-2xl">{currentChannel?.icon}</span>
              <h2 className="font-adonis text-2xl">{currentChannel?.name}</h2>
              {currentChannel?.isOpenPeriod && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-georgia-pro font-semibold">
                  OPEN PERIOD
                </span>
              )}
            </div>
            <p className="font-georgia-pro text-sm text-gray-500 ml-11">
              {currentChannel?.description}
            </p>
          </div>

          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-6 bg-gray-50"
          >
            {chatLoading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                  <p className="font-georgia-pro text-gray-600">Loading messages...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="font-adonis text-2xl mb-2">No messages yet</h3>
                  <p className="font-georgia-pro text-gray-500 mb-4">
                    Be the first to start the conversation!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-4xl mx-auto">
                {messages.slice().reverse().map((message) => {
                  const roleDisplay = getRoleDisplay(message.user?.role || 'viewer');
                  return (
                    <div key={message.id} className="flex gap-3 group">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center text-white font-semibold">
                          {message.user?.displayName?.charAt(0).toUpperCase() || '?'}
                        </div>
                      </div>

                      {/* Message content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-georgia-pro font-semibold text-sm">
                            {message.user?.alias || message.user?.displayName || 'Anonymous'}
                          </span>
                          <span className="text-xs" title={roleDisplay.label}>
                            {roleDisplay.icon}
                          </span>
                          <span className="font-georgia-pro text-xs text-gray-400">
                            {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                          </span>
                        </div>
                        
                        {/* Reply indicator */}
                        {message.replyToContent && (
                          <div className="mb-2 pl-3 border-l-2 border-gray-300 py-1">
                            <p className="font-georgia-pro text-xs text-gray-500">
                              Replying to {message.replyToUser}
                            </p>
                            <p className="font-georgia-pro text-xs text-gray-400 truncate">
                              {message.replyToContent}
                            </p>
                          </div>
                        )}

                        <p className="font-georgia-pro text-sm text-gray-800 whitespace-pre-wrap break-words">
                          {message.content}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-4 mt-2">
                          {/* Like button */}
                          {likeAccess.canAward && (
                            <button
                              onClick={() => handleLike(message.id)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-black transition"
                              title="Award like"
                            >
                              <span>👍</span>
                              {message.likesCount > 0 && (
                                <span className="font-semibold">{message.likesCount}</span>
                              )}
                            </button>
                          )}
                          {!likeAccess.canAward && message.likesCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <span>👍</span>
                              <span>{message.likesCount}</span>
                            </div>
                          )}
                          
                          {/* Reply count */}
                          {message.repliesCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <span>💬</span>
                              <span>{message.repliesCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="px-6 py-2 bg-white border-t border-gray-100">
            <p className="font-georgia-pro text-xs text-gray-400 italic h-4">
              {/* Typing indicator placeholder */}
            </p>
          </div>

          <div className="p-6 bg-white border-t border-gray-200">
            {!postAccess.canPost ? (
              <div className="text-center py-4">
                <p className="font-georgia-pro text-sm text-gray-500">
                  {postAccess.reason || 'You cannot post in this channel'}
                </p>
                {currentUser.membershipTier === 'freemium' && (
                  <a 
                    href="/join" 
                    className="inline-block mt-2 px-4 py-2 bg-black text-white rounded-full font-georgia-pro text-sm hover:bg-gray-800 transition"
                  >
                    Upgrade to Post
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {chatError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                    <p className="font-georgia-pro text-sm text-red-800">{chatError}</p>
                  </div>
                )}
                <div className="flex items-end space-x-3">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... (Shift+Enter for newline)"
                    className="flex-1 px-6 py-3 border border-gray-300 rounded-2xl font-georgia-pro focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 resize-none min-h-[48px] max-h-32"
                    rows={1}
                    disabled={isSending}
                  />
                  <button
                    onClick={handleSendMessage}
                    className="px-8 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!messageInput.trim() || isSending}
                  >
                    {isSending ? 'Sending...' : 'Send'}
                  </button>
                </div>
                <p className="font-georgia-pro text-xs text-gray-400 px-2">
                  Press Enter to send • Shift+Enter for new line
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
