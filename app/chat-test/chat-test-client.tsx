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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETUP FLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

                    // ✅ Only wait for balance if actually funded (API now handles this check)
                    if (!fundData.alreadyFunded && fundData.success) {
                        console.log('Waiting for gas to arrive...');
                        await new Promise(resolve => setTimeout(resolve, 10000)); // Simple 10s wait
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

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center max-w-md">
                <LoadingSpinner />
            </div>
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOWNS CHAT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KEY SHARER BOT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function KeySharerBot() {
    const [hasJoined, setHasJoined] = useState(false);
    const { joinSpace } = useJoinSpace();

    useEffect(() => {
        if (hasJoined || !SAVED_SPACE_ID) return;

        const joinAsBot = async () => {
            try {
                const { ethers } = await import('ethers-v5');
                const privateKey = (window as any).KEY_SHARER_PRIVATE_KEY;
                
                // ✅ Create wallet WITHOUT provider (just for address/signing)
                const botWallet = new ethers.Wallet(privateKey);
                const botAddress = botWallet.address;
                
                console.log('🤖 Bot address:', botAddress);
                console.log('🤖 Bot joining space...');
                
                // Mint and fund via API
                await fetch('/api/towns/mint-membership', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress: botAddress, spaceId: SAVED_SPACE_ID }),
                });
                
                const fundResponse = await fetch('/api/towns/fund-wallet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress: botAddress }),
                });
                const fundData = await fundResponse.json();
                console.log('💰 Fund result:', fundData);
                
                // ✅ Simple wait if funded (API now checks balance for us)
                if (!fundData.alreadyFunded && fundData.success) {
                    console.log('⏳ Waiting for gas...');
                    await new Promise(resolve => setTimeout(resolve, 15000));
                }
                
                // ✅ Connect wallet to provider only when needed for signing
                const provider = new ethers.providers.JsonRpcProvider(
                    process.env.NEXT_PUBLIC_BASE_RPC_URL
                );
                const connectedWallet = botWallet.connect(provider);
                
                // Join space
                console.log('🔗 Joining space...');
                await joinSpace(SAVED_SPACE_ID, connectedWallet, { skipMintMembership: false });
                console.log('✅ Bot joined successfully');
                setHasJoined(true);

            } catch (error: any) {
                if (error.message?.includes('already a member')) {
                    console.log('✅ Bot already a member');
                    setHasJoined(true);
                } else {
                    console.error('❌ Bot join failed:', error);
                    // Retry after 20s
                    setTimeout(() => window.location.reload(), 20000);
                }
            }
        };

        joinAsBot();
    }, [hasJoined, joinSpace]);

    if (!hasJoined) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <h1 className="font-adonis text-4xl mb-4">Key Sharer Starting...</h1>
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center">
                <h1 className="font-adonis text-4xl mb-4 text-green-600">✅ Key Sharer Online</h1>
                <p className="font-georgia-pro text-sm text-gray-400">
                    Connected at {new Date().toLocaleTimeString()}
                </p>
            </div>
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function ChatTestClient() {
    const [isMounted, setIsMounted] = useState(false);
    const wallet = useActiveWallet();
    const { isAgentConnected, connect } = useAgentConnection();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Bot auto-login
    useEffect(() => {
        if (!isMounted || typeof window === 'undefined') return;
        
        const privateKey = (window as any).KEY_SHARER_PRIVATE_KEY;
        const isAutoMode = (window as any).KEY_SHARER_AUTO_MODE;
        
        if (!privateKey || !isAutoMode || isAgentConnected) return;

        (async () => {
            try {
                console.log('🔐 Bot auto-login starting...');
                const { ethers } = await import('ethers-v5');
                
                // ✅ Create wallet without provider first
                const botWallet = new ethers.Wallet(privateKey);
                
                // ✅ Connect to provider only for Towns connection
                const provider = new ethers.providers.JsonRpcProvider(
                    process.env.NEXT_PUBLIC_BASE_RPC_URL
                );
                const connectedWallet = botWallet.connect(provider);
                
                await connect(connectedWallet, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => console.log('🔄 Token expired')
                });
                
                console.log('✅ Bot connected to Towns');
                (window as any).KEY_SHARER_CONNECTED = true;
            } catch (error) {
                console.error('❌ Bot login failed:', error);
                (window as any).KEY_SHARER_ERROR = error;
            }
        })();
    }, [isMounted, isAgentConnected, connect]);

    if (!isMounted) return <LoadingSpinner />;

    // Bot mode
    if (typeof window !== 'undefined' && (window as any).KEY_SHARER_AUTO_MODE) {
        if (!isAgentConnected) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-white">
                    <div className="text-center">
                        <h1 className="font-adonis text-4xl mb-4">🔐 Key Sharer Connecting...</h1>
                        <LoadingSpinner />
                    </div>
                </div>
            );
        }
        return <KeySharerBot />;
    }

    // User mode
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
