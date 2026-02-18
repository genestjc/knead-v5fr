'use client';

export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';

const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-600">Loading Chat... </p>
        </div>
    </div>
);

// Dynamically import ALL Towns logic with ssr: false
const ChatClient = nextDynamic(() => import('./chat-client'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

export default function ChatPage() {
  return <ChatClient />;
}
