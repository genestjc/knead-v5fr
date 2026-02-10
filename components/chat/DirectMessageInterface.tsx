'use client';

/**
 * Direct Message Interface Component
 * 
 * 1-on-1 chat interface for contributor DMs
 * - Real-time messages via Towns useTimeline hook
 * - Send messages
 * - Shows other participant info
 */

import { useState, useEffect, useRef } from 'react';
import { useDm, useSendMessage, useTimeline } from '@towns-protocol/react-sdk';

interface DirectMessageInterfaceProps {
  dmId: string;
  townsDmId: string;
  currentUserId: string;
  otherUserName: string;
}

export function DirectMessageInterface({
  dmId,
  townsDmId,
  currentUserId,
  otherUserName,
}: DirectMessageInterfaceProps) {
  // ✅ FIXED: Use useTimeline for messages, useDm for metadata
  const { data: dm } = useDm(townsDmId);
  const { data: events, isLoading } = useTimeline(townsDmId);
  const { sendMessage, isPending: isSending } = useSendMessage(townsDmId);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter for actual message events
  const messages = (events || []).filter((event: any) => 
    event.content?.kind === 'ChannelMessage' || event.localEvent?.payload?.content?.body
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;

    try {
      // Send DM via Towns SDK
      await sendMessage(messageInput);
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send DM:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
            {otherUserName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold text-lg">{otherUserName}</h2>
            <p className="text-sm text-gray-500">Contributor</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet.</p>
            <p className="text-sm mt-2">Start the conversation!</p>
          </div>
        ) : (
          messages.map((event: any, index: number) => {
            // Extract message data from event
            const msg = event.localEvent?.payload?.content || event.content;
            const authorId = event.creatorUserId || event.localEvent?.creatorUserId || '';
            const isCurrentUser = authorId.toLowerCase() === currentUserId.toLowerCase();
            const timestamp = event.localEvent?.confirmationTimeStampMs || Date.now();
            const messageText = msg?.body || msg?.text || '';
            
            return (
              <div
                key={event.hashStr || index}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[70%] rounded-lg px-4 py-2
                    ${isCurrentUser 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white text-gray-900 border'
                    }
                  `}
                >
                  <p className="text-sm">{messageText}</p>
                  <p className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
                    {new Date(timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSending}
          />
          <button
            onClick={handleSendMessage}
            disabled={isSending || !messageInput.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
