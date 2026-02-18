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
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { uploadToIPFS } from '@/lib/thirdweb/storage';
import { FileMessageDisplay } from './FileMessageDisplay';
import { Paperclip } from 'lucide-react';

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
  const { data: dm } = useDm(townsDmId);
  const { data: events, isLoading } = useTimeline(townsDmId);
  const { sendMessage, isPending: isSending } = useSendMessage(townsDmId);
  const [messageInput, setMessageInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ FIXED: Filter for ChannelMessage events only
  const messages = (events || []).filter(
    (event) => event.content?.kind === RiverTimelineEvent.ChannelMessage
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;

    try {
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const ipfsUri = await uploadToIPFS(file);
      
      // Send message with file info
      const fileMessage = `[FILE:${file.name}](${ipfsUri})`;
      await sendMessage(fileMessage);
      
      // Reset input
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
          messages.map((event, index) => {
            // ✅ FIXED: Access message body from event.content.body
            const messageText = event.content?.kind === RiverTimelineEvent.ChannelMessage 
              ? event.content.body 
              : '';
            
            // ✅ FIXED: Use event.creatorUserId for author
            const isCurrentUser = event.creatorUserId?.toLowerCase() === currentUserId.toLowerCase();
            
            // Use timestamp from event
            const timestamp = event.localEvent?.confirmationTimeStampMs || Date.now();
            
            // Check if message contains a file
            const fileMatch = messageText.match(/\[FILE:(.+?)\]\((.+?)\)/);
            const isFileMessage = !!fileMatch;
            const fileName = fileMatch?.[1];
            const ipfsUri = fileMatch?.[2];
            
            return (
              <div
                key={event.eventId || index}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[70%] rounded-[18px] px-4 py-2.5
                    ${isCurrentUser 
                      ? 'bg-[#007AFF] text-white' 
                      : 'bg-[#E5E5EA] text-gray-900'
                    }
                  `}
                  style={{ fontFamily: 'Georgia Pro, serif' }}
                >
                  {isFileMessage && fileName && ipfsUri ? (
                    <FileMessageDisplay 
                      fileName={fileName}
                      ipfsUri={ipfsUri}
                      isCurrentUser={isCurrentUser}
                    />
                  ) : (
                    <p className="text-sm leading-relaxed">{messageText}</p>
                  )}
                  <p className={`text-xs mt-1 ${isCurrentUser ? 'text-white/70' : 'text-gray-500'}`}>
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
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.txt,.doc,.docx,.mp4,.mov"
          />
          
          {/* Paperclip button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isSending}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Upload file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isUploading ? "Uploading file..." : "Type a message..."}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSending || isUploading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isSending || isUploading || !messageInput.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? 'Sending...' : isUploading ? 'Uploading...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
