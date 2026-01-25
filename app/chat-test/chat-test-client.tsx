'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';
import { useAgentConnection, useCreateSpace, useJoinSpace, useSpace } from '@towns-protocol/react-sdk';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { Button } from '@/components/ui/button';
import { createWallet, inAppWallet } from 'thirdweb/wallets';
import { getEthersV5Signer } from '@/lib/ethers-signer-adapter';

const SAVED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
const SAVED_CHANNEL_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;

const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega');

// ... LoadingSpinner, wallets, etc remain the same ...

export default function ChatTestClient() {
    const [isMounted, setIsMounted] = useState(false);
    
    const wallet = useActiveWallet();
    const { connect, connectUsingBearerToken, isAgentConnected, isAgentConnecting } = useAgentConnection();

    const BEARER_TOKEN_KEY = 'knead_towns_bearer_token';

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // ✅ Auto-reconnect with bearer token on mount
    useEffect(() => {
        if (!isMounted || !wallet || isAgentConnected || isAgentConnecting) return;

        const savedToken = localStorage.getItem(BEARER_TOKEN_KEY);
        
        if (savedToken) {
            console.log('🔄 Found saved bearer token, auto-reconnecting...');
            connectUsingBearerToken(savedToken, { townsConfig: TOWNS_CONFIG })
                .then((syncAgent) => {
                    if (syncAgent) {
                        console.log('✅ Auto-reconnected with bearer token');
                    }
                })
                .catch((error) => {
                    console.error('❌ Auto-reconnect failed:', error);
                    localStorage.removeItem(BEARER_TOKEN_KEY);
                });
        }
    }, [isMounted, wallet, isAgentConnected, isAgentConnecting, connectUsingBearerToken]);

    const handleConnectToTowns = async () => {
        if (!wallet || isAgentConnecting) return;
        
        try {
            console.log(`🔐 Connecting to Towns Protocol (omega)...`);
            
            const signer = await getEthersV5Signer(wallet, activeChain, client);
            
            // ✅ Use the built-in connect method - it handles persistence internally
            const syncAgent = await connect(signer, { townsConfig: TOWNS_CONFIG });
            
            console.log('✅ Connected to Towns Protocol');
            
            // Note: The SDK handles delegate persistence via IndexedDB automatically
            // For bearer token persistence, you'd need to get it from the Towns app
            // by typing /bearer-token in any conversation
            
        } catch (e: any) {
            console.error("Failed to connect to Towns:", e);
            alert(`Failed to connect to Towns: ${e.message}`);
        }
    };

    if (!isMounted || isAgentConnecting) {
        return <LoadingSpinner />;
    }
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            {!wallet ? (
                <div className="text-center max-w-md">
                    <h1 className="font-adonis text-4xl mb-4">Connect Your Wallet</h1>
                    <p className="font-georgia-pro text-lg mb-6 text-gray-600">
                        Connect your wallet to access Knead Chat.
                    </p>
                    <ConnectButton 
                        client={client} 
                        chain={activeChain}
                        wallets={wallets}
                    />
                </div>
            ) : !isAgentConnected ? (
                <div className="text-center max-w-md">
                    <h1 className="font-adonis text-4xl mb-4">Connect to Towns</h1>
                    <p className="font-georgia-pro text-lg mb-6 text-gray-600">
                        Sign a message to enter the chat.
                    </p>
                    <Button 
                        onClick={handleConnectToTowns} 
                        disabled={isAgentConnecting} 
                        className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition"
                    >
                        {isAgentConnecting ? 'Connecting...' : 'Connect to Towns'}
                    </Button>
                </div>
            ) : (
                <TownsConnectedContent />
            )}
        </div>
    );
}
