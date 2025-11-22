'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { ChatInput } from '@/components/chat/ChatInput';
import type { ChatMessage, ChatUser } from '@/types/chat';
// NEW: Import the message component that includes the options menu
import { ChatMessageComponent } from '@/components/chat/ChatMessage';

const TEST_CHANNEL_ID = 'live-interviews';

export default function SupabaseChatClient() {
  const user = useUser();
  const [supabase] = useState(() => createClientComponentClient());

  const [currentUserProfile, setCurrentUserProfile] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch(`/api/chat/messages?channelId=${TEST_CHANNEL_ID}&userId=${user.id}&limit=100`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch messages');
      }
      const { data, error: apiError } = await res.json();
      
      if (apiError) {
        setError(apiError);
      } else {
        setMessages(data.sort((a: ChatMessage, b: ChatMessage) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
        setError(null);
      }
    } catch (e: any) {
        setError(e.message);
    } finally {
        setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const fetchInitialData = async () => {
        setIsLoading(true);
        const { data: profileData } = await supabase.from('chat_users').select('*').eq('id', user.id).single();
        setCurrentUserProfile(profileData as ChatUser);
        await fetchMessages();
      };
      fetchInitialData();
    } else {
      setIsLoading(false);
    }
  }, [user, supabase, fetchMessages]);

  useEffect(() => {
    const channel = supabase
      .channel('chat-messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${TEST_CHANNEL_ID}` }, 
        (payload) => {
          // Re-fetch the list to get full message data with user profile
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchMessages]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


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

      <div className="flex-1 overflow-y-auto p-6 space-y-1">
        {error && (
            <div className="text-center text-red-500 p-4 bg-red-50 rounded-lg">
                <p className="font-bold">Access Denied</p>
                <p>{error}</p>
            </div>
        )}
        {/* UPDATED: Use the new ChatMessageComponent in the loop */}
        {!error && messages.map((msg) => (
          <ChatMessageComponent
            key={msg.id}
            message={msg}
            currentUser={currentUserProfile}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput channelId={TEST_CHANNEL_ID} onMessageSent={fetchMessages} />
    </div>
  );
}
