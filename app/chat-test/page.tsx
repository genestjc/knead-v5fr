'use client';

import { useState, useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { useAgentConnection, useTownsAuthStatus, useChannel, useSendMessage } from '@towns/react';
import { useSyncTownsToSupabase } from '@/hooks/useSyncTownsToSupabase';
import type { ChatUser } from '@/types/chat';

export default function ChatTestPage() {
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('main');
  const account = useActiveAccount();

  // Towns Protocol - Wallet-based authentication
  const { connect, disconnect } = useAgentConnection();
  const { isAuthenticated, isLoading: isConnecting } = useTownsAuthStatus();

  // Channel subscription (real-time messages)
  const { messages: townsMessages, isLoading: loadingMessages } = useChannel(selectedChannel);

  // Send message hook
  const { sendMessage, isSending, error: sendError } = useSendMessage();

  // Background sync to Supabase
  const { isSyncing, syncedCount } = useSyncTownsToSupabase(selectedChannel);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch or create Knead user profile
  useEffect(() => {
    async function fetchUser() {
      if (!account?.address) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/chat/get-or-create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: account.address,
          }),
        });

        const data = await response.json();
        
        if (data.success && data.user) {
          setCurrentUser(data.user);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [account?.address]);

  // Connect to Towns when wallet is connected
  useEffect(() => {
    if (account?.address && !isAuthenticated && !isConnecting) {
      connect().catch(err => {
        console.error('Failed to connect to Towns:', err);
      });
    }
  }, [account?.address, isAuthenticated, isConnecting, connect]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [townsMessages]);

  // Send message via Towns Protocol
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() || !currentUser || isSending || !isAuthenticated) {
      return;
    }

    try {
      // Send via Towns Protocol (wallet-signed, decentralized)
      await sendMessage(selectedChannel, messageInput, {
        kneadUserId: currentUser.id,
        walletAddress: account?.address,
        timestamp: new Date().toISOString(),
      });

      setMessageInput('');
      
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-600">Loading...</p>
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
            Connect your wallet to join the conversation
          </p>
          <ThirdWebConnectButton />
        </div>
      </div>
    );
  }

  // Wallet connected but Towns not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Connecting to Towns...</h1>
          {isConnecting ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
              <p className="font-georgia-pro text-gray-600">
                Please sign the message in your wallet to authenticate
              </p>
            </>
          ) : (
            <>
              <p className="font-georgia-pro text-gray-600 mb-6">
                Towns Protocol requires wallet signature for authentication
              </p>
              <button
                onClick={() => connect()}
                className="px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
              >
                Connect to Towns
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-adonis text-3xl">Knead Chat</h1>
            <p className="font-georgia-pro text-sm text-gray-600">
              {currentUser?.alias || currentUser?.displayName || 'Anonymous'}
              {' · '}
              <span className="text-xs">{currentUser?.membershipTier}</span>
              {isAuthenticated && <span className="text-xs text-green-600 ml-2">● Towns Connected</span>}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isSyncing && (
              <span className="text-xs text-gray-500">Syncing... ({syncedCount} messages)</span>
            )}
            <button
              onClick={() => disconnect()}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Disconnect Towns
            </button>
            <ThirdWebConnectButton />
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar - Channels */}
        <aside className="w-64 bg-white border-r border-gray-200 h-screen">
          <div className="p-4">
            <h2 className="font-georgia-pro font-semibold text-sm text-gray-500 uppercase mb-4">
              Channels
            </h2>
            <nav className="space-y-2">
              {['main', 'food', 'tech', 'art', 'fashion', 'live-interviews'].map(channel => (
                <button
                  key={channel}
                  onClick={() => setSelectedChannel(channel)}
                  className={`
                    w-full text-left px-4 py-2 rounded-lg font-georgia-pro transition
                    ${selectedChannel === channel 
                      ? 'bg-black text-white' 
                      : 'hover:bg-gray-100 text-gray-700'}
                  `}
                >
                  # {channel}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col h-screen">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loadingMessages ? (
              <div className="text-center text-gray-500 py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-2"></div>
                Loading messages...
              </div>
            ) : !townsMessages || townsMessages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p className="font-georgia-pro">No messages yet</p>
                <p className="text-sm mt-2">Be the first to start the conversation!</p>
              </div>
            ) : (
              townsMessages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                    {(msg.sender?.displayName || msg.sender?.username || 'A').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-georgia-pro font-semibold">
                        {msg.sender?.displayName || msg.sender?.username || 'Anonymous'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="font-georgia-pro text-gray-800">{msg.text}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t border-gray-200 p-4 bg-white">
            {sendError && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                Error: {sendError.message}
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                disabled={isSending || !isAuthenticated}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-georgia-pro focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isSending || !messageInput.trim() || !isAuthenticated}
                className="px-6 py-3 bg-black text-white rounded-lg font-georgia-pro hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
