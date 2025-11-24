'use client';

import nextDynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import the main chat component with ssr: false
const ConnectedChat = nextDynamic(() => import('./connected-chat'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-600">Loading Chat...</p>
        </div>
    </div>
);

// A placeholder for your user data logic
// Replace this with your actual user fetching logic
const mockUser = {
    id: 'user-123',
    alias: 'KneadUser',
    displayName: 'Knead User',
    membershipTier: 'Baker',
};

export default function ChatTestPage() {
    const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
    const defaultChannelId = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;

    // TODO: Replace this with your actual user data fetching
    const currentUser = mockUser; 

    if (!spaceId || !defaultChannelId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white p-4">
                <div className="max-w-2xl w-full bg-yellow-50 rounded-lg p-8 text-center border border-yellow-200">
                    <h1 className="font-adonis text-4xl mb-4 text-yellow-800">Configuration Needed</h1>
                    <p className="font-georgia-pro text-lg mb-6 text-yellow-900">
                        The chat environment variables are not set up yet.
                    </p>
                    <p className="font-georgia-pro text-sm mb-8 text-yellow-700">
                        You need to find your existing Space and Channel ID to configure the chat.
                    </p>
                    <Link
                        href="/find-space"
                        className="inline-block px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition"
                    >
                        Find My Space ID →
                    </Link>
                </div>
            </div>
        );
    }
    
    return (
        <ConnectedChat
            currentUser={currentUser}
            spaceId={spaceId}
            defaultChannelId={defaultChannelId}
        />
    );
}
