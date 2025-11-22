'use client';

import { useState, useRef } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'sonner';
import { useRealtimeProfile } from '@/hooks/use-realtime-profile'; // Import the hook to get user profile

interface ChatInputProps {
  channelId: string;
  onMessageSent: () => void;
}

export function ChatInput({ channelId, onMessageSent }: ChatInputProps) {
  const user = useUser();
  const { profile } = useRealtimeProfile(user?.id || null); // Get the user's full profile
  
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClientComponentClient();

  // --- NEW: Permission Check ---
  // Determine if the current user has permission to upload files.
  const canUploadFiles = profile && ['contributor', 'admin', 'master-admin'].includes(profile.role);
  // --- End of Permission Check ---

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setContent(prevContent => prevContent + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Redundant check for extra security
    if (!canUploadFiles) {
      toast.error("You don't have permission to upload files.");
      return;
    }

    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    if (!user) return;

    setIsSending(true);
    toast.loading('Uploading file...');

    try {
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('message_attachments')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('message_attachments')
        .getPublicUrl(fileName);

      await sendMessage('', urlData.publicUrl, file.type);
    } catch (error: any) {
      toast.error(`File upload failed: ${error.message}`);
    } finally {
      setIsSending(false);
      toast.dismiss();
    }
  };

  const sendMessage = async (textContent: string, attachmentUrl?: string, attachmentType?: string) => {
    // Final security check on the backend is still recommended, but this prevents the UI from even trying.
    if (attachmentUrl && !canUploadFiles) {
        toast.error("You do not have permission to send attachments.");
        return;
    }

    if (!user || (!textContent && !attachmentUrl)) return;
    
    setIsSending(true);
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          channelId: channelId,
          content: textContent,
          attachmentUrl: attachmentUrl,
          attachmentType: attachmentType,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send message');
      
      setContent('');
      onMessageSent();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSending(false);
    }
  };
  
  const handleSend = () => {
    if (content.trim()) {
      sendMessage(content.trim());
    }
  };

  return (
    <div className="p-4 bg-white border-t relative">
      {showEmojiPicker && (
        <div className="absolute bottom-full mb-2">
          <EmojiPicker onEmojiClick={handleEmojiClick} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-gray-500 hover:text-gray-800">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
        
        {/* --- NEW: Conditionally render the upload button --- */}
        {canUploadFiles && (
          <>
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-gray-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          </>
        )}
        
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSending}
        />
        <button onClick={handleSend} disabled={isSending || !content.trim()} className="px-6 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition disabled:opacity-50">
          {isSending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
