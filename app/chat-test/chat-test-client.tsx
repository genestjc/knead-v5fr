'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';

import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { Button } from '@/components/ui/button';

const ConnectedChat = nextDynamic(() => import('./connected-chat'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-600">Loading...</p>
        </div>
    </div>
);

const mockUser = {
    id: 'user-123',
    alias: 'KneadUser',
    displayName: 'Knead User',
    membershipTier: 'Baker',
};

export default function ChatTestClient() {
    const [spaceId, setSpaceId] = useState<string | null>(null);
    const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
    const [isCreatingSpace, setIsCreatingSpace] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    const wallet = useActiveWallet();

    // Ensure we're only running in the browser
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const currentUser = mockUser; 

    // Create space using your EXISTING backend API
    const handleCreateSpace = async () => {
        if (!wallet) return;
        setIsCreatingSpace(true);
        
        try {
            console.log('🚀 Creating space via backend API...');
            
            // Call YOUR existing backend route
            const response = await fetch('/api/towns/create-space', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: 'Knead Chat Space',
                }),
            });

            const data = await response.json();

            if (! data.success) {
                throw new Error(data.error || 'Failed to create space');
            }

            console.log('✅ Space created successfully:', data);
            console.log('   - Space ID:', data.spaceId);
            console.log('   - Default Channel ID:', data. defaultChannelId);
            console.log('   - Transaction:', data.transactionHash);

            setSpaceId(data.spaceId);
            setDefaultChannelId(data.defaultChannelId);

        } catch (error:  any) {
            console.error('❌ Failed to create space:', error);
            alert(`Failed to create space: ${error. message}`);
        } finally {
            setIsCreatingSpace(false);
        }
    };

    // Don't render until mounted (browser only)
    if (!isMounted) {
        return <LoadingSpinner />;
    }
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            {! wallet ? (
                <div className="text-center max-w-md">
                    <h1 className="font-adonis text-4xl mb-4">Connect Your Wallet</h1>
                    <p className="font-georgia-pro text-lg mb-6 text-gray-600">
                        Connect your wallet to access Knead Chat. 
                    </p>
                    <ConnectButton client={client} chain={activeChain} />
                </div>
            ) : !spaceId ? (
                <div className="text-center max-w-md">
                    <h1 className="font-adonis text-4xl mb-4">Create Your Chat Space</h1>
                    <p className="font-georgia-pro text-lg mb-6 text-gray-600">
                        Create a Towns space to start chatting.  
                    </p>
                    <Button 
                        onClick={handleCreateSpace} 
                        disabled={isCreatingSpace}
                        className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition"
                    >
                        {isCreatingSpace ? 'Creating Space...' : 'Create Space'}
                    </Button>
                </div>
            ) : defaultChannelId ? (
                <div className="w-full h-screen">
                    <ConnectedChat
                        currentUser={currentUser}
                        spaceId={spaceId}
                        defaultChannelId={defaultChannelId}
                    />
                </div>
            ) : (
                <div className="text-center">
                    <LoadingSpinner />
                    <p className="font-georgia-pro text-gray-600 mt-4">
                        Loading space data...
                    </p>
                </div>
            )}
        </div>
    );
}
