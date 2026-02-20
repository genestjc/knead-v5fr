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
import { useDm, useSendMessage, useTimeline, useMyMember, useRedact, useReactions, useReact } from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { uploadToIPFS } from '@/lib/thirdweb/storage';
import { FileMessageDisplay } from './FileMessageDisplay';
import { Paperclip, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import data from '@emoji-mart/data';
import { Picker } from 'emoji-mart';

function EmojiPickerComponent({ onEmojiSelect, onClickOutside }: { onEmojiSelect: (emoji: { native: string }) => void; onClickOutside: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const picker = new Picker({ data, onEmojiSelect, onClickOutside, theme: 'light', previewPosition: 'none', skinTonePosition: 'none' });
    ref.current.appendChild(picker as unknown as Node);
    return () => {
      if (ref.current) ref.current.innerHTML = '';
    };
  }, [onEmojiSelect, onClickOutside]);

  return <div ref={ref} />;
}

interface DirectMessageInterfaceProps {
  dmId: string;
  townsDmId: string;
  currentUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
}

interface DmMessageItemProps {
  event: any;
  isCurrentUser: boolean;
  timestamp: number;
  displayAvatar?: string;
  displayName: string;
  townsDmId: string;
  deletingEventId: string | null;
  showEmojiPickerForEvent: string | null;
  onDelete: (eventId: string) => void;
  onToggleEmojiPicker: (eventId: string | null) => void;
  convertIpfsToGatewayUrl: (uri: string) => string;
}

function DmMessageItem({
  event,
  isCurrentUser,
  timestamp,
  displayAvatar,
  displayName,
  townsDmId,
  deletingEventId,
  showEmojiPickerForEvent,
  onDelete,
  onToggleEmojiPicker,
  convertIpfsToGatewayUrl,
}: DmMessageItemProps) {
  const { data: reactions } = useReactions(townsDmId, event.eventId || '');
  const { react } = useReact(townsDmId);

  const messageText = event.content?.kind === RiverTimelineEvent.ChannelMessage
    ? event.content.body
    : '';
  const fileMatch = messageText.match(/\[FILE:(.+?)\]\((.+?)\)/);
  const isFileMessage = !!fileMatch;
  const fileName = fileMatch?.[1];
  const ipfsUri = fileMatch?.[2];

  const handleReactionClick = async (emoji: string) => {
    try {
      await react(event.eventId!, emoji);
    } catch (error: any) {
      console.error('❌ Failed to toggle reaction:', error);
      toast.error('Failed to update reaction');
    }
  };

  const handleEmojiSelect = async (emoji: { native: string }) => {
    onToggleEmojiPicker(null);
    try {
      await react(event.eventId!, emoji.native);
    } catch (error: any) {
      console.error('❌ Failed to add reaction:', error);
      toast.error('Failed to add reaction');
    }
  };

  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} group`}>
      <div className={`flex gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'} items-end max-w-[70%] relative`}>
        {/* Profile picture for other user */}
        {!isCurrentUser && (
          <div className="flex-shrink-0">
            {displayAvatar ? (
              <img
                src={convertIpfsToGatewayUrl(displayAvatar)}
                alt={displayName}
                className="w-5 h-5 rounded-full object-cover border-[1.5px] border-gray-200"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[9px] font-semibold">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col">
          {/* ✅ No bubble wrapper around images — render clean */}
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
                  minute: '2-digit',
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
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}

          {/* Emoji Reactions Display */}
          {reactions && Object.keys(reactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(reactions).map(([emoji, reactionData]: [string, any]) => {
                const count = reactionData?.count ?? 0;
                const hasMyReaction = reactionData?.myReaction ?? false;
                if (count === 0) return null;
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReactionClick(emoji)}
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                      hasMyReaction
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span className="font-georgia-pro">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Emoji Reaction Button (shows on hover) */}
        {event.eventId && (
          <div className="relative self-center">
            <button
              onClick={() => onToggleEmojiPicker(showEmojiPickerForEvent === event.eventId ? null : event.eventId)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded-full"
              title="Add reaction"
            >
              <span className="text-xs">😊</span>
            </button>
            {showEmojiPickerForEvent === event.eventId && (
              <div className={`absolute ${isCurrentUser ? 'right-0' : 'left-0'} bottom-full mb-1 z-20`}>
                <EmojiPickerComponent
                  onEmojiSelect={handleEmojiSelect}
                  onClickOutside={() => onToggleEmojiPicker(null)}
                />
              </div>
            )}
          </div>
        )}

        {/* Delete button for own messages */}
        {isCurrentUser && event.eventId && (
          <button
            onClick={() => onDelete(event.eventId!)}
            disabled={deletingEventId === event.eventId}
            className="self-center opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded-full disabled:opacity-50"
            title="Delete message"
          >
            {deletingEventId === event.eventId ? (
              <span className="text-xs">⏳</span>
            ) : (
              <span className="text-xs">🗑️</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
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
  const { userId: myUserId } = useMyMember(townsDmId);
  const { redact } = useRedact(townsDmId);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [showEmojiPickerForEvent, setShowEmojiPickerForEvent] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Filter for ChannelMessage events only
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

  const handleDeleteMessage = async (eventId: string) => {
    if (!confirm('Delete your message?')) return;

    setDeletingEventId(eventId);
    try {
      await redact(eventId);
      toast.success('Message deleted');
    } catch (error: any) {
      console.error('❌ Failed to delete message:', error);
      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes('bad_prev_miniblock_hash') || errorMsg.includes('miniblock')) {
        toast.error('⏱️ Channel is syncing. Wait a moment and try again.');
      } else if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
        toast.error('❌ Permission denied');
      } else {
        toast.error('Failed to delete message');
      }
    } finally {
      setDeletingEventId(null);
    }
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
            const senderId = event.sender?.id || '';
            const isCurrentUser = myUserId
              ? senderId === myUserId
              : Boolean(currentUserId && senderId?.toLowerCase() === currentUserId.toLowerCase());
            
            const timestamp = event.localEvent?.confirmationTimeStampMs || Date.now();
            
            return (
              <DmMessageItem
                key={event.eventId || index}
                event={event}
                isCurrentUser={isCurrentUser}
                timestamp={timestamp}
                displayAvatar={displayAvatar}
                displayName={displayName}
                townsDmId={townsDmId}
                deletingEventId={deletingEventId}
                showEmojiPickerForEvent={showEmojiPickerForEvent}
                onDelete={handleDeleteMessage}
                onToggleEmojiPicker={setShowEmojiPickerForEvent}
                convertIpfsToGatewayUrl={convertIpfsToGatewayUrl}
              />
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
              <ArrowRight className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
