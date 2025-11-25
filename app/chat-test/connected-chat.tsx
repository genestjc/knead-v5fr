'use client';

import { useState, useEffect, useRef } from 'react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
// --- ADDING useSyncAgent FOR A STRONGER CHECK ---
import { useAgentConnection, useChannel, useSendMessage, useTimeline, useSyncAgent } from '@towns-protocol/react-sdk';
import type { ChatUser } from '@/types/chat';

interface ConnectedChatProps {
  currentUser: ChatUser;
  spaceId: string;
  defaultChannelId: string;
}

const LoadingSpinner = () => (
    <div className="text-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
        <p className="font-georgia-pro text-gray-500">Initializing Channel...</p>
    </div>
);

export default function ConnectedChat({ currentUser, spaceId, defaultChannelId }: ConnectedChatProps) {
  const [messageInput, setMessageInput] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState(defaultChannelId);
  
  const { disconnect } = useAgentConnection();
  // --- THE STRONGER CHECK: Get the agent object itself ---
  const agent = useSyncAgent();

  // --- We will only call the hooks once the agent is confirmed to exist ---
  const { data: channel, isLoading: isChannelLoading } = useChannel(agent ? spaceId : undefined, selectedChannelId);
  const { data: timeline, isLoading: isTimelineLoading } = useTimeline(agent ? channel?.streamId : undefined);
  const { sendMessage, isPending: isSending } = useSendMessage(agent ? channel?.streamId : undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !currentUser || isSending || !agent) return;

    try {
      await sendMessage({ text: messageInput });
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Check console for details.');
    }
  };
  
  // --- If the agent isn't ready yet, we show a loading state ---
  if (!agent || isChannelLoading) {
    return (
        <div className="w-full h-screen bg-gray-50 flex items-center justify-center">
            <LoadingSpinner />
        </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-adonis text-3xl">Knead Chat</h1>
            <p className="font-georgia-pro text-sm text-gray-600">
              {currentUser?.alias} · <span className="text-xs">{currentUser?.membershipTier}</span>
              {agent && <span className="text-xs text-green-600 ml-2">● Connected</span>}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => disconnect()} className="text-xs text-gray-500 hover:text-gray-700">Disconnect</button>
            <ThirdWebConnectButton />
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex max-w-7xl mx-auto w-full flex-grow">
        <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
          <div className="p-4">
            <h2 className="font-georgia-pro font-semibold text-sm text-gray-500 uppercase mb-4">Channels</h2>
            <nav className="space-y-2">
              <button className="w-full text-left px-4 py-2 rounded-lg font-georgia-pro bg-black text-white">
                # {channel?.name || 'general'}
              </button>
            </nav>
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isTimelineLoading ? <LoadingSpinner /> : (
              timeline?.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No messages yet.</div>
              ) : (
                timeline?.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-georgia-pro font-semibold">{event.sender || 'Anonymous'}</span>
                        <span className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="font-georgia-pro text-gray-800">{event.message?.text}</p>
                    </div>
                  </div>
                ))
              )
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-200 p-4 bg-white">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 border rounded-lg"
                disabled={isSending}
              />
              <button type="submit" disabled={isSending || !messageInput.trim()} className="px-6 bg-black text-white rounded-lg">Send</button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
