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

                    if (!fundData.alreadyFunded && fundData.success) {
                        console.log('Waiting for gas to arrive...');
                        await new Promise(resolve => setTimeout(resolve, 10000));
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
    const { data: space, isLoading: isSpaceLoading } = useSpace(spaceId || '');

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

    // Debug logging for space sync status
    useEffect(() => {
        if (space) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📊 Space Sync Status:');
            console.log('   Initialized:', space.initialized);
            console.log('   Channel IDs:', space.channelIds);
            console.log('   Metadata:', space.metadata);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
    }, [space]);

    useEffect(() => {
        if (hasJoined || !wallet || !SAVED_SPACE_ID) return;

        const joinSpaceNow = async () => {
            try {
                const hasJoinedBefore = localStorage.getItem(`joined_${SAVED_SPACE_ID}`);
                
                if (hasJoinedBefore) {
                    console.log('✅ User already joined before (from localStorage)');
                    setSpaceId(SAVED_SPACE_ID);
                    setHasJoined(true);
                    return;
                }

                console.log('🚀 Joining space for the first time...');
                const signer = await getEthersV5Signer(wallet, activeChain, client);
                
                await joinSpace(SAVED_SPACE_ID, signer, { skipMintMembership: false });
                
                console.log('✅ Join space successful!');
                localStorage.setItem(`joined_${SAVED_SPACE_ID}`, 'true');
                setSpaceId(SAVED_SPACE_ID);
                setHasJoined(true);

            } catch (error: any) {
                if (error.message?.includes('already a member')) {
                    console.log('✅ Already a member - treating as success');
                    localStorage.setItem(`joined_${SAVED_SPACE_ID}`, 'true');
                    setSpaceId(SAVED_SPACE_ID);
                    setHasJoined(true);
                } else {
                    console.error('❌ Join failed:', error);
                    alert(`Failed to join space: ${error.message}`);
                }
            }
        };

        joinSpaceNow();
    }, [wallet, hasJoined, joinSpace]);

    // ✅ CRITICAL: Wait for space to be fully initialized
    if (isSpaceLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <LoadingSpinner />
                    <p className="font-georgia-pro text-sm text-gray-500 mt-4">
                        Loading space data...
                    </p>
                </div>
            </div>
        );
    }

    if (!space) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <p className="font-georgia-pro text-red-500">❌ Space not found</p>
                </div>
            </div>
        );
    }

    // ✅ CRITICAL: Don't render until space is initialized
    if (!space.initialized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <LoadingSpinner />
                    <p className="font-georgia-pro text-sm text-gray-500 mt-4">
                        Syncing with stream nodes...
                    </p>
                    <p className="font-georgia-pro text-xs text-gray-400 mt-2">
                        This may take a few seconds
                    </p>
                </div>
            </div>
        );
    }

    // ✅ CRITICAL: Get channel ID from synced space data
    const channelId = space.channelIds?.[0];

    if (!channelId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <p className="font-georgia-pro text-red-500">❌ No channels found in space</p>
                    <p className="font-georgia-pro text-sm text-gray-500 mt-2">
                        Space ID: {spaceId?.substring(0, 16)}...
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-black text-white rounded-full"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // ✅ Only render chat when everything is ready
    if (hasJoined && currentUser) {
        return (
            <div className="w-full h-screen">
                <ConnectedChat
                    currentUser={currentUser}
                    spaceId={spaceId!}
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
    const { data: space, isLoading: isSpaceLoading } = useSpace(SAVED_SPACE_ID || '');

    useEffect(() => {
        if (hasJoined || !SAVED_SPACE_ID) return;

        const joinAsBot = async () => {
            try {
                const { ethers } = await import('ethers-v5');
                const privateKey = (window as any).KEY_SHARER_PRIVATE_KEY;
                
                const botWallet = new ethers.Wallet(privateKey);
                const botAddress = botWallet.address;
                
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🤖 Bot Join Attempt Starting');
                console.log('   Bot Address:', botAddress);
                console.log('   Space ID:', SAVED_SPACE_ID);
                console.log('   Auto-login already connected:', !!(window as any).KEY_SHARER_CONNECTED);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                const provider = new ethers.providers.JsonRpcProvider(
                    process.env.NEXT_PUBLIC_BASE_RPC_URL
                );
                const balance = await provider.getBalance(botAddress);
                const balanceEth = ethers.utils.formatEther(balance);
                
                console.log('💰 Current balance:', balanceEth, 'ETH');
                
                if (balance.eq(0)) {
                    console.error('❌ Bot wallet has ZERO ETH! Cannot proceed.');
                    throw new Error('Bot wallet has no ETH');
                }
                
                const connectedWallet = botWallet.connect(provider);
                
                // Check if already joined before
                const hasJoinedBefore = localStorage.getItem(`bot_joined_${SAVED_SPACE_ID}`);
                
                if (!hasJoinedBefore) {
                    console.log('🚀 Attempting to join space...');
                    console.log('   Towns SDK will handle channel access automatically');
                    
                    await joinSpace(SAVED_SPACE_ID, connectedWallet, { 
                        skipMintMembership: false
                    });
                    
                    console.log('✅ Successfully joined space!');
                    localStorage.setItem(`bot_joined_${SAVED_SPACE_ID}`, 'true');
                } else {
                    console.log('✅ Bot already joined space before (from localStorage)');
                }
                
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('✅ BOT JOINED SUCCESSFULLY!');
                console.log('   Channels will be available after space syncs');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                setHasJoined(true);

            } catch (error: any) {
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('❌ Bot Join Failed:');
                console.error('   Message:', error.message || 'Unknown error');
                console.error('   Code:', error.code || 'N/A');
                console.error('   Reason:', error.reason || 'N/A');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                // Handle common error cases
                if (error.message?.includes('already a member') || 
                    error.message?.includes('already in space') ||
                    error.message?.includes('already joined')) {
                    console.log('✅ Bot appears to already be a member - treating as success');
                    localStorage.setItem(`bot_joined_${SAVED_SPACE_ID}`, 'true');
                    setHasJoined(true);
                    return;
                }
                
                // Don't treat permission/funding errors as success
                if (error.message?.includes('PERMISSION_DENIED') ||
                    error.message?.includes('INSUFFICIENT_FUNDS') ||
                    error.code === 'INSUFFICIENT_FUNDS') {
                    console.error('❌ Join failed with permission/funding error');
                    console.error('💡 Bot needs manual intervention');
                    return;
                }
                
                console.error('❌ Join failed - manual intervention needed');
            }
        };

        joinAsBot();
    }, [hasJoined, joinSpace]);

    // Debug logging for space sync status
    useEffect(() => {
        if (space) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🤖 Bot Space Sync Status:');
            console.log('   Initialized:', space.initialized);
            console.log('   Channels:', space.channelIds?.length || 0);
            console.log('   Channel IDs:', space.channelIds);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
    }, [space]);

    // Wait for space to load
    if (isSpaceLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <h1 className="font-adonis text-4xl mb-4">Key Sharer Starting...</h1>
                    <LoadingSpinner />
                    <p className="font-georgia-pro text-sm text-gray-500 mt-4">
                        Loading space data...
                    </p>
                </div>
            </div>
        );
    }

    // Wait for space to sync (same pattern as TownsChat)
    if (!space?.initialized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <h1 className="font-adonis text-4xl mb-4">Key Sharer Syncing...</h1>
                    <LoadingSpinner />
                    <p className="font-georgia-pro text-sm text-gray-500 mt-4">
                        Syncing with stream nodes...
                    </p>
                    <p className="font-georgia-pro text-xs text-gray-400 mt-2">
                        This may take a few seconds
                    </p>
                </div>
            </div>
        );
    }

    // Bot is ready when space is synced
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center">
                <h1 className="font-adonis text-4xl mb-4 text-green-600">✅ Key Sharer Online</h1>
                <p className="font-georgia-pro text-sm text-gray-600 mb-2">
                    Channels: {space.channelIds?.length || 0}
                </p>
                <p className="font-georgia-pro text-xs text-gray-400">
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
                
                const botWallet = new ethers.Wallet(privateKey);
                
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
