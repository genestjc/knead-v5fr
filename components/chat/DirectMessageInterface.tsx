'use client';

import { useState, useEffect, useRef } from 'react';
import { useDm, useSendMessage, useTimeline, useMyMember, useRedact } from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { useActiveAccount } from 'thirdweb/react';
import { uploadToIPFS } from '@/lib/thirdweb/storage';
import { memberFetch } from '@/lib/auth/member-fetch';
import { FileMessageDisplay } from './FileMessageDisplay';
import { DailyDmVideoCall } from './DailyDmVideoCall';
import { Paperclip, ArrowRight, Video, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';

const VIDEO_CALL_INVITE_PREFIX = '📹 [VIDEO_CALL_INVITE]';

interface DirectMessageInterfaceProps {
  dmId: string;
  townsDmId: string;
  currentUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
}

function DmMessageItem({
  event,
  isCurrentUser,
  timestamp,
  displayAvatar,
  displayName,
  deletingEventId,
  onDelete,
  convertIpfsToGatewayUrl,
}: any) {
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
  const activeAccount = useActiveAccount();
  
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoCallActive, setVideoCallActive] = useState(false);
  const [videoRoomUrl, setVideoRoomUrl] = useState<string | null>(null);
  const [videoToken, setVideoToken] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [incomingCallRoomUrl, setIncomingCallRoomUrl] = useState<string | null>(null);
  const [incomingCallRoomName, setIncomingCallRoomName] = useState<string | null>(null);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [videoCallsEnabled, setVideoCallsEnabled] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const messages = (events || []).filter(
    (event) =>
      event.content?.kind === RiverTimelineEvent.ChannelMessage &&
      !(event.content?.body || '').startsWith(VIDEO_CALL_INVITE_PREFIX)
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowVideoMenu(false);
      }
    };
    if (showVideoMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVideoMenu]);

  useEffect(() => {
    if (!events || events.length === 0 || !myUserId) return;
    const lastEvent = events[events.length - 1];
    if (lastEvent?.content?.kind !== RiverTimelineEvent.ChannelMessage) return;
    const senderId = lastEvent.sender?.id || '';
    const isFromOtherUser = senderId !== myUserId;
    if (!isFromOtherUser) return;
    const messageText = lastEvent.content?.body || '';
    if (!messageText.startsWith(VIDEO_CALL_INVITE_PREFIX)) return;
    const urlMatch = messageText.match(/\((.+?)\)$/);
    if (urlMatch?.[1]) {
      const roomUrl = urlMatch[1];
      const roomName = roomUrl.split('/').pop() || '';
      setIncomingCallRoomUrl(roomUrl);
      setIncomingCallRoomName(roomName);
      toast.info(`${otherUserName} is calling you! 📹`);
    }
  }, [events, myUserId, otherUserName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;

    console.log('🔍 Attempting to send message...');
    console.log('   townsDmId:', townsDmId);
    console.log('   myUserId:', myUserId);
    console.log('   dm initialized:', dm?.initialized);
    console.log('   dm isJoined:', dm?.isJoined);

    try {
      await sendMessage(messageInput);
      console.log('✅ Message sent successfully');
      setMessageInput('');
    } catch (error: any) {
      console.error('❌ Failed to send DM:', error);
      
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('unimplemented') || errorMsg.includes('404')) {
        toast.error('⚠️ Towns network issue. Please try again in a moment.');
      } else if (errorMsg.includes('bad_prev_miniblock_hash') || errorMsg.includes('miniblock')) {
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
      toast.error(error.message || 'Failed to upload file. Please try again.');
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
      toast.error('Failed to delete message');
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleStartVideoCall = async () => {
    if (!videoCallsEnabled) {
      toast.error('Video calls are disabled for this conversation');
      return;
    }
    if (!activeAccount) {
      toast.error('Please connect your wallet');
      return;
    }
    setLoadingVideo(true);
    try {
      // The member session proves the caller; the server verifies they are a
      // participant before creating the room / issuing an owner token.
      const roomResponse = await memberFetch('/api/dm/create-video-room', activeAccount, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId1: currentUserId, userId2: dmId }),
      });
      const roomData = await roomResponse.json();
      if (!roomData.success) throw new Error(roomData.error);

      const { roomUrl, roomName } = roomData.data;

      const inviteMessage = `${VIDEO_CALL_INVITE_PREFIX}(${roomUrl})`;
      await sendMessage(inviteMessage);

      const tokenResponse = await memberFetch('/api/dm/generate-dm-token', activeAccount, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName }),
      });
      const tokenData = await tokenResponse.json();
      if (!tokenData.success) throw new Error(tokenData.error);
      
      setVideoRoomUrl(roomUrl);
      setVideoToken(tokenData.data.token);
      setVideoCallActive(true);
      toast.success('Video call started');
    } catch (error: any) {
      console.error('Failed to start video call:', error);
      toast.error(`Failed to start video call: ${error.message}`);
    } finally {
      setLoadingVideo(false);
    }
  };

  const handleJoinIncomingCall = async () => {
    if (!incomingCallRoomUrl || !incomingCallRoomName) {
      toast.error('Call information is missing. Please ask the caller to try again.');
      return;
    }
    if (!activeAccount) {
      toast.error('Please connect your wallet');
      return;
    }
    setLoadingVideo(true);
    try {
      const tokenResponse = await memberFetch('/api/dm/generate-dm-token', activeAccount, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: incomingCallRoomName }),
      });
      const tokenData = await tokenResponse.json();
      if (!tokenData.success) throw new Error(tokenData.error);
      
      setVideoRoomUrl(incomingCallRoomUrl);
      setVideoToken(tokenData.data.token);
      setVideoCallActive(true);
      setIncomingCallRoomUrl(null);
      setIncomingCallRoomName(null);
      toast.success('Joined video call');
    } catch (error: any) {
      console.error('Failed to join video call:', error);
      toast.error('Failed to join video call. Please try again.');
    } finally {
      setLoadingVideo(false);
    }
  };

  const handleDismissIncomingCall = () => {
    setIncomingCallRoomUrl(null);
    setIncomingCallRoomName(null);
    toast.info('Call dismissed');
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
          otherUserName={otherUserName}
          onClose={handleCloseVideoCall}
        />
      ) : (
        <>
          <div className="border-b px-6 py-4 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {otherUserAvatar ? (
                  <img
                    src={convertIpfsToGatewayUrl(otherUserAvatar)}
                    alt={otherUserName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                    {otherUserName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="font-adonis text-lg">{otherUserName}</h2>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleStartVideoCall}
                  disabled={loadingVideo || !videoCallsEnabled}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={videoCallsEnabled ? 'Start video call' : 'Video calls disabled'}
                >
                  {loadingVideo ? <span className="text-sm">⏳</span> : <Video className="w-5 h-5" />}
                </button>
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowVideoMenu(!showVideoMenu)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                    title="More options"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {showVideoMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <button
                        onClick={() => {
                          setVideoCallsEnabled(!videoCallsEnabled);
                          toast.success(videoCallsEnabled ? 'Video calls disabled' : 'Video calls enabled');
                          setShowVideoMenu(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm font-georgia-pro hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        {videoCallsEnabled ? 'Disable video calls' : 'Enable video calls'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {incomingCallRoomUrl && !videoCallActive && (
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-georgia-pro text-sm font-medium text-blue-900">
                    📹 {otherUserName} is calling you
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleJoinIncomingCall}
                    disabled={loadingVideo}
                    className="px-4 py-1.5 bg-green-600 text-white rounded-full text-sm font-georgia-pro hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loadingVideo ? 'Joining...' : 'Join Call'}
                  </button>
                  <button
                    onClick={handleDismissIncomingCall}
                    className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-full text-sm font-georgia-pro hover:bg-gray-300 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

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
                const isCurrentUser = senderId === myUserId;
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
                    displayAvatar={otherUserAvatar}
                    displayName={otherUserName}
                    deletingEventId={deletingEventId}
                    onDelete={handleDeleteMessage}
                    convertIpfsToGatewayUrl={convertIpfsToGatewayUrl}
                  />
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

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
