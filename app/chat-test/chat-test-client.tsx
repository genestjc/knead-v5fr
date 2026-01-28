'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo } from 'react';
import { useAgentConnection, useJoinSpace, useSpace } from '@towns-protocol/react-sdk';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { createWallet, inAppWallet } from 'thirdweb/wallets';
import { getEthersV5Signer } from '@/lib/ethers-signer-adapter';
import type { ChatUser } from '@/types/chat';

const SAVED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
const SAVED_CHANNEL_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;

const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega', {
  rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL,
});

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

const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  inAppWallet({
    auth: {
      options: ["email", "google", "apple", "phone"],
    },
  }),
];

// ✅ Bot Auto-Login Component
function KeySharerBot() {
    const { connect, isAgentConnected } = useAgentConnection();
    const [attempted, setAttempted] = useState(false);

    useEffect(() => {
        // Check if we're in bot mode
        const isBot = typeof window !== 'undefined' && 
                     window.KEY_SHARER_AUTO_MODE === true;
        
        if (!isBot || attempted || isAgentConnected) return;

        const autoConnect = async () => {
            try {
                console.log('🔑 KEY SHARER: Starting auto-connect...');
                setAttempted(true);
                
                const privateKey = window.KEY_SHARER_PRIVATE_KEY;
                if (!privateKey) {
                    throw new Error('Missing KEY_SHARER_PRIVATE_KEY');
                }

                console.log('🔑 KEY SHARER: Creating wallet from private key...');
                const { ethers } = await import('ethers-v5');
                const botWallet = new ethers.Wallet(privateKey);
                const botAddress = botWallet.address;
                
                console.log(`🔑 KEY SHARER: Bot address: ${botAddress}`);

                // Fund wallet via API
                console.log('💰 KEY SHARER: Checking/funding wallet...');
                const fundResponse = await fetch('/api/towns/fund-wallet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress: botAddress }),
                });

                if (!fundResponse.ok) {
                    const error = await fundResponse.json();
                    console.error('❌ KEY SHARER: Fund wallet failed:', error);
                    throw new Error(`Fund wallet failed: ${error.error}`);
                }

                const fundData = await fundResponse.json();
                console.log('✅ KEY SHARER: Wallet funded:', fundData);

                // Wait for balance if just funded
                if (!fundData.alreadyFunded) {
                    console.log('⏳ KEY SHARER: Waiting for gas to arrive...');
                    const provider = new ethers.providers.JsonRpcProvider(
                        process.env.NEXT_PUBLIC_BASE_RPC_URL
                    );
                    
                    for (let i = 0; i < 20; i++) {
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        const balance = await provider.getBalance(botAddress);
                        if (balance.gt(0)) {
                            console.log(`✅ KEY SHARER: Balance confirmed: ${ethers.utils.formatEther(balance)} ETH`);
                            await new Promise(resolve => setTimeout(resolve, 5000));
                            break;
                        }
                    }
                }

                // Connect to Towns
                console.log('🔌 KEY SHARER: Connecting to Towns...');
                const signer = botWallet.connect(
                    new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL)
                );

                await connect(signer, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => console.log('🔑 KEY SHARER: Token expired')
                });

                console.log('✅ KEY SHARER: Connected to Towns!');
                window.KEY_SHARER_CONNECTED = true;

            } catch (error: any) {
                console.error('❌ KEY SHARER: Auto-connect failed:', error);
                window.KEY_SHARER_ERROR = error.message;
                window.KEY_SHARER_CONNECTED = false;
            } finally {
                window.KEY_SHARER_ATTEMPTED = true;
            }
        };

        autoConnect();
    }, [connect, isAgentConnected, attempted]);

    return null;
}

function SetupFlow() {
    const wallet = useActiveWallet();
    const { connect, isAgentConnected } = useAgentConnection();
    const [setupComplete, setSetupComplete] = useState(false);

    useEffect(() => {
        if (!wallet || isAgentConnected || setupComplete) return;

        const runSetup = async () => {
            try {
                const userAddress = wallet.getAccount()?.address;
                if (!userAddress) return;

                const hasJoinedBefore = localStorage.getItem(`joined_${SAVED_SPACE_ID}`);
                
                if (!hasJoinedBefore) {
                    await fetch('/api/towns/mint-membership', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userAddress, spaceId: SAVED_SPACE_ID }),
                    });

                    const fundResponse = await fetch('/api/towns/fund-wallet', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userAddress }),
                    });
                    const fundData = await fundResponse.json();

                    if (!fundData.alreadyFunded) {
                        const { ethers } = await import('ethers-v5');
                        const provider = new ethers.providers.JsonRpcProvider(
                            process.env.NEXT_PUBLIC_BASE_RPC_URL
                        );
                        
                        for (let i = 0; i < 20; i++) {
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            const balance = await provider.getBalance(userAddress);
                            if (balance.gt(0)) {
                                await new Promise(resolve => setTimeout(resolve, 5000));
                                break;
                            }
                        }
                    }
                }

                const signer = await getEthersV5Signer(wallet, activeChain, client);
                await connect(signer, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => console.log('Token expired')
                });
                setSetupComplete(true);

            } catch (error: any) {
                console.error('Setup failed:', error);
                alert(`Setup failed: ${error.message}`);
            }
        };

        runSetup();
    }, [wallet, isAgentConnected, setupComplete, connect]);

    return <LoadingSpinner />;
}

function TownsChat() {
    const [spaceId, setSpaceId] = useState<string | null>(SAVED_SPACE_ID || null);
    const [hasJoined, setHasJoined] = useState(false);

    const wallet = useActiveWallet();
    const { joinSpace } = useJoinSpace();
    const { data: space } = useSpace(spaceId || '');

    const currentUser: ChatUser | null = useMemo(() => {
        const address = wallet?.getAccount()?.address;
        if (!address) return null;
        
        return {
            id: address,
            address: address,
            displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
            role: 'viewer',
            membershipTier: 'freemium',
            isBanned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }, [wallet]);

    useEffect(() => {
        if (hasJoined || !wallet || !SAVED_SPACE_ID) return;

        const joinSpaceNow = async () => {
            try {
                const hasJoinedBefore = localStorage.getItem(`joined_${SAVED_SPACE_ID}`);
                if (hasJoinedBefore) {
                    setSpaceId(SAVED_SPACE_ID);
                    setHasJoined(true);
                    return;
                }

                const signer = await getEthersV5Signer(wallet, activeChain, client);
                await joinSpace(SAVED_SPACE_ID, signer, { skipMintMembership: false });
                
                localStorage.setItem(`joined_${SAVED_SPACE_ID}`, 'true');
                setSpaceId(SAVED_SPACE_ID);
                setHasJoined(true);

            } catch (error: any) {
                if (error.message?.includes('already a member')) {
                    localStorage.setItem(`joined_${SAVED_SPACE_ID}`, 'true');
                    setSpaceId(SAVED_SPACE_ID);
                    setHasJoined(true);
                } else {
                    console.error('Join failed:', error);
                }
            }
        };

        joinSpaceNow();
    }, [wallet, hasJoined, joinSpace]);

    const channelId = space?.channelIds?.[0] || SAVED_CHANNEL_ID;

    if (hasJoined && spaceId && channelId && currentUser) {
        return (
            <div className="w-full h-screen">
                <ConnectedChat
                    currentUser={currentUser}
                    spaceId={spaceId}
                    defaultChannelId={channelId}
                />
            </div>
        );
    }

    return <LoadingSpinner />;
}

export default function ChatTestClient() {
    const [isMounted, setIsMounted] = useState(false);
    const wallet = useActiveWallet();
    const { isAgentConnected } = useAgentConnection();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // ✅ Check if bot mode BEFORE rendering
    const isBot = typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE === true;

    if (!isMounted) return <LoadingSpinner />;

    // ✅ Bot mode - no wallet needed
    if (isBot) {
        return (
            <>
                <KeySharerBot />
                {isAgentConnected ? <TownsChat /> : <LoadingSpinner />}
            </>
        );
    }

    // ✅ Regular user mode
    if (!wallet) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center max-w-md">
                    <h1 className="font-adonis text-4xl mb-4">Connect Your Wallet</h1>
                    <ConnectButton client={client} chain={activeChain} wallets={wallets} />
                </div>
            </div>
        );
    }

    if (!isAgentConnected) {
        return <SetupFlow />;
    }

    return <TownsChat />;
}
