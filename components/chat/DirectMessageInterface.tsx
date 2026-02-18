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
import { useDm, useSendMessage, useTimeline, useMemberList } from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { uploadToIPFS } from '@/lib/thirdweb/storage';
import { FileMessageDisplay } from './FileMessageDisplay';
import { Paperclip, ArrowUp } from 'lucide-react';

interface DirectMessageInterfaceProps {
  dmId: string;
  townsDmId: string;
  currentUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
}

export function DirectMessageInterface({
  dmId,
  townsDmId,
  currentUserId,
  otherUserName,
  otherUserAvatar,
}: DirectMessageInterfaceProps) {
  const { data: dm } = useDm(townsDmId);
  const { data: events, isLoading } = useTimeline(townsDmId);
  const { sendMessage, isPending: isSending } = useSendMessage(townsDmId);
  const { data: members } = useMemberList(townsDmId);
  const [messageInput, setMessageInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Build a set of IDs that belong to the current user
  // Towns SDK creatorUserId may be a Towns-internal ID, not the raw wallet address.
  // In a 2-person DM, whichever member ID is NOT the other user must be us.
  const selfIds = useRef(new Set<string>());

  useEffect(() => {
    if (!members?.userIds || members.userIds.length === 0) return;
    const ids = new Set<string>();
    // Always include the raw wallet address (lowercased)
    ids.add(currentUserId.toLowerCase());
    // In a 2-person DM, the member that isn't "other" is "self"
    for (const uid of members.userIds) {
      // If the uid is clearly different from otherUserName/address, it's us
      if (uid.toLowerCase() !== otherUserName.toLowerCase()) {
        ids.add(uid.toLowerCase());
      }
    }
    selfIds.current = ids;
  }, [members, currentUserId, otherUserName]);

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

  const convertIpfsToGatewayUrl = (uri: string): string => {
    if (uri && uri.startsWith('ipfs://')) {
      return `https://ipfs.thirdwebcdn.com/ipfs/${uri.replace('ipfs://', '')}`;
    }
    return uri || '';
  };

  // ✅ Use otherUserName directly — no duplicate profile fetch
  const displayName = otherUserName;
  const displayAvatar = otherUserAvatar;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 bg-white">
        <div className="flex items-center gap-3">
          {displayAvatar ? (
            <img
              src={convertIpfsToGatewayUrl(displayAvatar)}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="font-adonis text-lg">{displayName}</h2>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {isLoading ? (
          <div className="text-center text-gray-500 py-8 font-georgia-pro">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8 font-georgia-pro">
            <p>No messages yet.</p>
            <p className="text-sm mt-2">Start the conversation!</p>
          </div>
        ) : (
          messages.map((event, index) => {
            const messageText = event.content?.kind === RiverTimelineEvent.ChannelMessage 
              ? event.content.body 
              : '';
            
            // ✅ FIXED: Check against our set of known self IDs
            const creatorId = (event.creatorUserId || '').toLowerCase();
            const isCurrentUser = selfIds.current.has(creatorId);
            
            const timestamp = event.localEvent?.confirmationTimeStampMs || Date.now();
            
            const fileMatch = messageText.match(/\[FILE:(.+?)\]\((.+?)\)/);
            const isFileMessage = !!fileMatch;
            const fileName = fileMatch?.[1];
            const ipfsUri = fileMatch?.[2];
            
            return (
              <div
                key={event.eventId || index}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'} items-end max-w-[70%]`}>
                  {/* Profile picture for other user */}
                  {!isCurrentUser && (
                    <div className="flex-shrink-0">
                      {displayAvatar ? (
                        <img
                          src={convertIpfsToGatewayUrl(displayAvatar)}
                          alt={displayName}
                          className="w-6 h-6 rounded-full object-cover border-2 border-gray-200"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-semibold">
                          {displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* ✅ FIXED: No bubble wrapper around images — render clean */}
                  {isFileMessage && fileName && ipfsUri ? (
                    <div>
                      <FileMessageDisplay 
                        fileName={fileName}
                        ipfsUri={ipfsUri}
                        isCurrentUser={isCurrentUser}
                      />
                      <p className={`text-xs mt-1 font-georgia-pro ${isCurrentUser ? 'text-right text-gray-400' : 'text-gray-500'}`}>
                        {new Date(timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`
                        rounded-[18px] px-4 py-2.5
                        ${isCurrentUser 
                          ? 'bg-[#007AFF] text-white' 
                          : 'bg-[#E5E5EA] text-gray-900'
                        }
                      `}
                    >
                      <p className="font-georgia-pro text-sm leading-relaxed">{messageText}</p>
                      <p className={`text-xs mt-1 font-georgia-pro ${isCurrentUser ? 'text-white/70' : 'text-gray-500'}`}>
                        {new Date(timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4 bg-white">
        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.txt,.doc,.docx,.mp4,.mov"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isSending}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            title="Upload file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isUploading ? "Uploading file..." : "Type a message"}
            className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 font-georgia-pro"
            disabled={isSending || isUploading}
          />
          
          <button
            onClick={handleSendMessage}
            disabled={isSending || isUploading || !messageInput.trim()}
            className="w-10 h-10 flex items-center justify-center bg-[#007AFF] text-white rounded-full hover:bg-[#0066DD] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            {isSending || isUploading ? (
              <span className="text-sm">⏳</span>
            ) : (
              <ArrowUp className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
