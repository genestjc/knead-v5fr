'use client';

import { useState, useEffect, useRef } from 'react';
import { useAgentConnection, useChannel, useSendMessage, useTimeline } from '@towns-protocol/react-sdk';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { MessageBubble, EventBanner, TypingIndicator } from '@/components/chat/MessageBubble';
import type { ChatUser } from '@/types/chat';
import { useActiveAccount } from 'thirdweb/react';

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

export default function ConnectedChat({ currentUser, spaceId, defaultChannelId }: ConnectedChatProps) {
  const [messageInput, setMessageInput] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState(defaultChannelId);
  const [activeEvent, setActiveEvent] = useState<{title: string; timeRemaining?: string} | null>(null);
  
  const { disconnect } = useAgentConnection();
  const activeAccount = useActiveAccount();

  const { data: channel, isLoading: isChannelLoading } = useChannel(spaceId, selectedChannelId);
  const { data: timeline, isLoading: isTimelineLoading } = useTimeline(channel?.streamId);
  const { sendMessage, isPending: isSending } = useSendMessage(channel?.streamId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !currentUser || isSending || !channel?.streamId) return;

    try {
      await sendMessage({ text: messageInput });
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Check console for details.');
    }
  };

  // Transform timeline events to message format
  const messages = timeline?.map((event: any) => ({
    id: event.id,
    content: event.message?.text || '',
    sender: {
      id: event.creatorUserId || '',
      name: event.sender || 'Anonymous',
      avatar: undefined,
    },
    timestamp: event.timestamp || Date.now(),
    isOwn: event.creatorUserId === activeAccount?.address,
  })) || [];

  return (
    <ChatLayout>
      <div className="h-full flex flex-col bg-white">
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
              placeholder="iMessage"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#007AFF] font-georgia-pro"
              disabled={isSending || isChannelLoading}
            />
            <button 
              type="submit" 
              disabled={isSending || !messageInput.trim()} 
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
