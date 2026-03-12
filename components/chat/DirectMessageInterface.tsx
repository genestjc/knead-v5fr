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
import { useDm, useSendMessage, useTimeline, useMyMember, useRedact, useSyncAgent } from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { uploadToIPFS } from '@/lib/thirdweb/storage';
import { FileMessageDisplay } from './FileMessageDisplay';
import { DailyDmVideoCall } from './DailyDmVideoCall';
import { Paperclip, ArrowRight, Video, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';

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
  onDelete: (eventId: string) => void;
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
  onDelete,
  convertIpfsToGatewayUrl,
}: DmMessageItemProps) {
  const messageText = event.content?.kind === RiverTimelineEvent.ChannelMessage
    ? event.content.body
    : '';
  const fileMatch = messageText.match(/\[FILE:(.+?)\]\((.+?)\)/);
  const isFileMessage = !!fileMatch;
  const fileName = fileMatch?.[1];
  const ipfsUri = fileMatch?.[2];

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
        </div>

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
  const syncAgent = useSyncAgent();
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video call state
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [videoRoomUrl, setVideoRoomUrl] = useState<string | null>(null);
  const [videoToken, setVideoToken] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  // ✅ Filter for ChannelMessage events only
  const messages = (events || []).filter(
    (event) => event.content?.kind === RiverTimelineEvent.ChannelMessage
  );

  // Join DM stream and sync encryption keys on mount (Towns Protocol best practice)
  useEffect(() => {
    if (!townsDmId || !syncAgent) return;

    const joinDmStream = async () => {
      try {
        const dmStream = (syncAgent.dms as any).getDm(townsDmId); // cast needed: SDK types don't expose getDm
        if (dmStream) {
          if (typeof dmStream.join === 'function') {
            await dmStream.join();
          }
          if (typeof dmStream.waitForKeysToSync === 'function') {
            await dmStream.waitForKeysToSync({ timeout: 30000 });
          }
          console.log('✅ DM stream joined and keys synced');
        }
      } catch (error) {
        console.error('❌ Failed to join DM stream:', error);
      }
    };

    joinDmStream();
  }, [townsDmId, syncAgent]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;

    try {
      await sendMessage(messageInput);
      setMessageInput('');
    } catch (error: any) {
      console.error('Failed to send DM:', error);
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('bad_prev_miniblock_hash') || errorMsg.includes('miniblock')) {
        toast.error('⏱️ Channel is syncing. Wait a moment and try again.');
      } else if (errorMsg.includes('timeout')) {
        toast.error('Network timeout. Please try again.');
      } else if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
        toast.error('❌ Permission denied');
      } else {
        toast.error('Failed to send message. Please try again.');
      }
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

  const handleStartVideoCall = async () => {
    setLoadingVideo(true);
    try {
      const roomResponse = await fetch('/api/dm/create-video-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId1: currentUserId, userId2: dmId }),
      });

      const roomData = await roomResponse.json();
      if (!roomData.success) {
        throw new Error(roomData.error);
      }

      const tokenResponse = await fetch('/api/dm/generate-dm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: roomData.data.roomName,
          walletAddress: currentUserId,
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.success) {
        throw new Error(tokenData.error);
      }

      setVideoRoomUrl(roomData.data.roomUrl);
      setVideoToken(tokenData.data.token);
      setVideoCallActive(true);
    } catch (error: any) {
      console.error('Failed to start video call:', error);
      toast.error(`Failed to start video call: ${error.message}`);
    } finally {
      setLoadingVideo(false);
    }
  };

  const handleCloseVideoCall = () => {
    setVideoCallActive(false);
    setVideoRoomUrl(null);
    setVideoToken(null);
  };

  return (
    <div className="flex flex-col h-full">
      {videoCallActive && videoRoomUrl && videoToken ? (
        <DailyDmVideoCall
          roomUrl={videoRoomUrl}
          token={videoToken}
          currentUserAddress={currentUserId}
          otherUserName={displayName}
          onClose={handleCloseVideoCall}
        />
      ) : (
        <>
          {/* Header */}
          <div className="border-b px-6 py-4 bg-white">
            <div className="flex items-center justify-between">
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

              {/* Video + menu controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleStartVideoCall}
                  disabled={loadingVideo}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                  title="Start video call"
                >
                  {loadingVideo ? (
                    <span className="text-sm">⏳</span>
                  ) : (
                    <Video className="w-5 h-5" />
                  )}
                </button>
                {/* More options menu — reserved for future settings (mute, block, etc.) */}
                <button
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors opacity-50 cursor-not-allowed"
                  title="More options (coming soon)"
                  disabled
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
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

                // ✅ Use protocol's authoritative timestamp field
                const timestamp =
                  (event as any).createdAtEpochMs ||
                  (event as any).created_at_epoch_ms ||
                  Date.now();

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
                    onDelete={handleDeleteMessage}
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
                placeholder={isUploading ? 'Uploading file...' : 'Type a message'}
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
        </>
      )}
    </div>
  );
}
