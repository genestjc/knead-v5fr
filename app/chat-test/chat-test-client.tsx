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

// ✅ Debug RPC URL
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL;
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 RPC Configuration Check:');
console.log('   BASE_RPC_URL:', BASE_RPC_URL?.substring(0, 50) + '...');
console.log('   Is Alchemy?:', BASE_RPC_URL?.includes('alchemy'));
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (!BASE_RPC_URL || !BASE_RPC_URL.includes('alchemy')) {
  console.error('❌ CRITICAL: Not using Alchemy RPC! This will cause rate limits.');
  console.error('   Set NEXT_PUBLIC_BASE_RPC_URL in your .env.local file');
}

const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega', {
  rpcUrl: BASE_RPC_URL,
});

console.log('🏙️ Towns Config:', TOWNS_CONFIG);

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
    const [setupStep, setSetupStep] = useState("Preparing...");

    useEffect(() => {
        if (!wallet || isAgentConnected || setupComplete) return;

        const runSetup = async () => {
            try {
                const userAddress = wallet.getAccount()?.address;
                if (!userAddress) return;

                // Step 1: Fund wallet with gas
                setSetupStep("Funding wallet with gas...");
                console.log('💰 Funding wallet with gas');
                
                const fundResponse = await fetch('/api/towns/fund-wallet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress }),
                });
                const fundData = await fundResponse.json();

                if (!fundData.success) {
                    throw new Error(fundData.error || 'Failed to fund wallet');
                }

                console.log('✅ Wallet funded:', fundData.alreadyFunded ? 'already had funds' : 'funded successfully');

                // Wait a bit if we just funded
                if (!fundData.alreadyFunded && fundData.success) {
                    console.log('⏳ Waiting for gas to arrive...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }

                // Step 2: Connect to Towns agent
                setSetupStep("Connecting to Towns...");
                console.log('🔌 Connecting to Towns agent');
                console.log('   Using RPC:', BASE_RPC_URL?.substring(0, 50) + '...');
                
                const signer = await getEthersV5Signer(wallet, activeChain, client);
                await connect(signer, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => console.log('Token expired')
                });
                
                console.log('✅ Towns agent connected');
                setSetupComplete(true);

            } catch (error: any) {
                console.error('Setup failed:', error);
                setSetupStep("Setup failed - please refresh");
                alert(`Setup failed: ${error.message}`);
            }
        };

        runSetup();
    }, [wallet, isAgentConnected, setupComplete, connect]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center max-w-md px-4">
                <h2 className="font-adonis text-3xl mb-4">Setting Up Chat</h2>
                <LoadingSpinner />
                <p className="font-georgia-pro text-sm text-gray-500 mt-4">
                    {setupStep}
                </p>
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
    const [showJoinPrompt, setShowJoinPrompt] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

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

    // Check if user needs to join (run once on mount)
    useEffect(() => {
        if (!wallet || !SAVED_SPACE_ID) return;

        const hasJoinedBefore = localStorage.getItem(`joined_${SAVED_SPACE_ID}`);
        
        if (hasJoinedBefore) {
            console.log('✅ User already joined before (from localStorage)');
            setSpaceId(SAVED_SPACE_ID);
            setHasJoined(true);
        } else {
            console.log('⏳ User needs to join space - showing prompt');
            setShowJoinPrompt(true);
        }
    }, [wallet]);

    // Handle join button click
    const handleJoinClick = async () => {
        if (!wallet || !SAVED_SPACE_ID) return;
        
        setIsJoining(true);
        try {
            console.log('🚀 Joining space for the first time...');
            console.log('   Using RPC:', BASE_RPC_URL?.substring(0, 50) + '...');
            
            const signer = await getEthersV5Signer(wallet, activeChain, client);
            
            await joinSpace(SAVED_SPACE_ID, signer, { skipMintMembership: true });
            
            console.log('✅ Join space successful!');
            localStorage.setItem(`joined_${SAVED_SPACE_ID}`, 'true');
            setSpaceId(SAVED_SPACE_ID);
            setHasJoined(true);
            setShowJoinPrompt(false);

        } catch (error: any) {
            if (error.message?.includes('already a member')) {
                console.log('✅ Already a member - treating as success');
                localStorage.setItem(`joined_${SAVED_SPACE_ID}`, 'true');
                setSpaceId(SAVED_SPACE_ID);
                setHasJoined(true);
                setShowJoinPrompt(false);
            } else {
                console.error('❌ Join failed:', error);
                alert(`Failed to join space: ${error.message}`);
            }
        } finally {
            setIsJoining(false);
        }
    };

    // Show join prompt BEFORE loading space
    if (showJoinPrompt) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center max-w-md px-4">
                    <h1 className="font-adonis text-4xl mb-4">Join Knead Community</h1>
                    <p className="font-georgia-pro text-gray-600 mb-2">
                        Connect with other readers and writers in our community chat.
                    </p>
                    <p className="font-georgia-pro text-sm text-gray-500 mb-6">
                        One-time setup — you'll be asked to sign a transaction.
                    </p>
                    <button
                        onClick={handleJoinClick}
                        disabled={isJoining}
                        className="px-8 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {isJoining ? "Joining..." : "Join Community Chat"}
                    </button>
                    <p className="font-georgia-pro text-xs text-gray-400 mt-4">
                        Gas fees covered by Knead
                    </p>
                </div>
            </div>
        );
    }

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
                console.log('   Using RPC:', BASE_RPC_URL?.substring(0, 50) + '...');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                const provider = new ethers.providers.JsonRpcProvider(BASE_RPC_URL);
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
                    
                    await joinSpace(SAVED_SPACE_ID, connectedWallet, { 
                        skipMintMembership: true
                    });
                    
                    console.log('✅ Successfully joined space!');
                    localStorage.setItem(`bot_joined_${SAVED_SPACE_ID}`, 'true');
                } else {
                    console.log('✅ Bot already joined space before (from localStorage)');
                }
                
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('✅ BOT JOINED SUCCESSFULLY!');
                console.log('━━━━━━━━━━━━���━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                setHasJoined(true);

            } catch (error: any) {
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('❌ Bot Join Failed:');
                console.error('   Message:', error.message || 'Unknown error');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                if (error.message?.includes('already a member') || 
                    error.message?.includes('already in space') ||
                    error.message?.includes('already joined')) {
                    console.log('✅ Bot appears to already be a member');
                    localStorage.setItem(`bot_joined_${SAVED_SPACE_ID}`, 'true');
                    setHasJoined(true);
                }
            }
        };

        joinAsBot();
    }, [hasJoined, joinSpace]);

    useEffect(() => {
        if (space) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🤖 Bot Space Sync Status:');
            console.log('   Initialized:', space.initialized);
            console.log('   Channels:', space.channelIds?.length || 0);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
    }, [space]);

    if (isSpaceLoading || !space?.initialized) {
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
                <p className="font-georgia-pro text-sm text-gray-600 mb-2">
                    Channels: {space.channelIds?.length || 0}
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
                const provider = new ethers.providers.JsonRpcProvider(BASE_RPC_URL);
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
