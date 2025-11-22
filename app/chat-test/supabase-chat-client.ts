'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { ChatInput } from '@/components/chat/ChatInput'; // The component we built with emojis/attachments
import type { ChatMessage, ChatUser } from '@/types/chat';

// A placeholder channel ID for testing. All messages will be saved with this ID.
const TEST_CHANNEL_ID = 'live-interviews';

export default function SupabaseChatClient() {
  const user = useUser();
  const [currentUserProfile, setCurrentUserProfile] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponentClient();

  const fetchMessages = useCallback(async () => {
    if (!user) return;

    // This API call now includes all our permission checks
    const { data, error: apiError, nextCursor } = await fetch(`/api/chat/messages?channelId=${TEST_CHANNEL_ID}&userId=${user.id}&limit=100`).then(res => res.json());

    if (apiError) {
      setError(apiError);
      setIsLoading(false);
      return;
    }
    
    setMessages(data.sort((a: ChatMessage, b: ChatMessage) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    setIsLoading(false);
  }, [user]);

  // Fetch initial messages and user profile
  useEffect(() => {
    if (user) {
      const fetchUserProfile = async () => {
        const { data } = await supabase.from('chat_users').select('*').eq('id', user.id).single();
        setCurrentUserProfile(data as ChatUser);
      };
      fetchUserProfile();
      fetchMessages();
    } else {
      setIsLoading(false);
    }
  }, [user, fetchMessages, supabase]);

  // Set up a real-time subscription to new messages
  useEffect(() => {
    const channel = supabase
      .channel('chat-messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${TEST_CHANNEL_ID}` }, 
        (payload) => {
          // This is a simplified fetch; a full implementation would be more robust
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchMessages]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!user || !currentUserProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="text-center">
          <h1 className="font-adonis text-3xl mb-4">Welcome to Knead Chat</h1>
          <p className="font-georgia-pro text-gray-600 mb-6">Connect your wallet to join the conversation.</p>
          <ThirdWebConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b p-4 text-center">
        <h1 className="font-adonis text-2xl">Knead Chat (Supabase Mode)</h1>
        <p className="font-georgia-pro text-sm text-gray-500">#{TEST_CHANNEL_ID}</p>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && (
            <div className="text-center text-red-500 p-4 bg-red-50 rounded-lg">
                <p className="font-bold">Access Denied</p>
                <p>{error}</p>
            </div>
        )}
        {!error && messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-3">
             <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0">
                {/* Avatar Placeholder */}
             </div>
             <div>
                <div className="flex items-baseline gap-2">
                    <span className="font-georgia-pro font-semibold">{msg.user?.displayName || 'Anonymous'}</span>
                    <span className="text-xs text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="font-georgia-pro text-gray-800">{msg.content}</p>
                {msg.attachmentUrl && <img src={msg.attachmentUrl} alt="attachment" className="mt-2 rounded-lg max-w-xs" />}
             </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput channelId={TEST_CHANNEL_ID} onMessageSent={fetchMessages} />
    </div>
  );
}
