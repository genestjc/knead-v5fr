'use client';

import { useState, useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { useAgentConnection, useChannel, useSendMessage, useTimeline } from '@towns-protocol/react-sdk';
import type { ChatUser } from '@/types/chat';

interface ConnectedChatProps {
  currentUser: ChatUser;
  spaceId: string;
  defaultChannelId: string;
}

export default function ConnectedChat({ currentUser, spaceId, defaultChannelId }: ConnectedChatProps) {
  const [messageInput, setMessageInput] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState(defaultChannelId);
  const account = useActiveAccount();

  const { disconnect, isAgentConnected } = useAgentConnection();

  // --- SDK Correction: Hooks need spaceId and channelId ---
  const { data: channel } = useChannel(spaceId, selectedChannelId);
  
  // --- SDK Correction: These hooks use the channel's streamId ---
  const { data: timeline } = useTimeline(channel?.streamId);
  const { sendMessage, isPending: isSending } = useSendMessage(channel?.streamId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline]); // Changed to trigger on timeline update

  // Send message via Towns Protocol
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() || !currentUser || isSending || !isAgentConnected) {
      return;
    }

    try {
      // --- SDK Correction: The sendMessage function takes an object ---
      await sendMessage({ text: messageInput });
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-adonis text-3xl">Knead Chat</h1>
            <p className="font-georgia-pro text-sm text-gray-600">
              {currentUser?.alias || currentUser?.displayName || 'Anonymous'}
              {' · '}
              <span className="text-xs">{currentUser?.membershipTier}</span>
              {isAgentConnected && <span className="text-xs text-green-600 ml-2">● Towns Connected</span>}
            </p>
          </div>
          <div className="flex items-center gap-4">
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

      <div className="flex max-w-7xl mx-auto w-full flex-grow">
        {/* Sidebar - Channels */}
        <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
          <div className="p-4">
            <h2 className="font-georgia-pro font-semibold text-sm text-gray-500 uppercase mb-4">
              Channels
            </h2>
            <nav className="space-y-2">
              <button
                onClick={() => setSelectedChannelId(defaultChannelId)}
                className={`
                  w-full text-left px-4 py-2 rounded-lg font-georgia-pro transition
                  ${selectedChannelId === defaultChannelId 
                    ? 'bg-black text-white' 
                    : 'hover:bg-gray-100 text-gray-700'}
                `}
              >
                # {channel?.name || 'general'}
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {timeline?.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p className="font-georgia-pro">No messages yet</p>
                <p className="text-sm mt-2">Be the first to start the conversation!</p>
              </div>
            ) : (
              timeline?.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {(event.sender || 'A').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-georgia-pro font-semibold">
                        {event.sender || 'Anonymous'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="font-georgia-pro text-gray-800">
                      {event.message?.text}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                disabled={isSending || !isAgentConnected}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-georgia-pro focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isSending || !messageInput.trim() || !isAgentConnected}
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
