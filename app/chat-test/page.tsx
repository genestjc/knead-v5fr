'use client';

import nextDynamic from 'next/dynamic';

// Dynamically import the chat component with ssr: false
const ChatTestClient = nextDynamic(() => import('./chat-test-client'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
        <p className="font-georgia-pro text-gray-600">Loading chat...</p>
      </div>
    </div>
  ),
});

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export default function ChatTestPage() {
  return <ChatTestClient />;
}
