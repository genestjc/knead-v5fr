'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo } from 'react';
import { useAgentConnection, useJoinSpace, useSpace, useTimeline, useSendMessage } from '@towns-protocol/react-sdk';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { createWallet, inAppWallet } from 'thirdweb/wallets';
import { getEthersV5Signer } from '@/lib/ethers-signer-adapter';
import type { ChatUser } from '@/types/chat';

const SAVED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
const SAVED_CHANNEL_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;

// ✅ Version localStorage keys to invalidate old "joins" without NFT minting
const JOIN_VERSION = 'v2';

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━��━━━━
// SETUP FLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SetupFlow() {
    const wallet = useActiveWallet();
    const { connect, isAgentConnected } = useAgentConnection();
    const [setupComplete, setSetupComplete] = useState(false);
    const [setupStep, setSetupStep] = useState("Preparing your account...");

    useEffect(() => {
        if (!wallet || isAgentConnected || setupComplete) return;

        const runSetup = async () => {
            try {
                const userAddress = wallet.getAccount()?.address;
                if (!userAddress) return;

                const hasJoinedBefore = localStorage.getItem(`joined_${JOIN_VERSION}_${SAVED_SPACE_ID}_${userAddress}`);
                
                if (!hasJoinedBefore) {
                    setSetupStep("Creating your membership...");
                    await fetch('/api/towns/mint-membership', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userAddress, spaceId: SAVED_SPACE_ID }),
                    });

                    // Fund wallet (happens silently, no UI update)
                    const fundResponse = await fetch('/api/towns/fund-wallet', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userAddress }),
                    });
                    const fundData = await fundResponse.json();

                    if (!fundData.alreadyFunded && fundData.success) {
                        console.log('⏳ Waiting for gas to arrive...');
                        await new Promise(resolve => setTimeout(resolve, 10000));
                    }
                }

                setSetupStep("Connecting to network...");
                const signer = await getEthersV5Signer(wallet, activeChain, client);
                
                await connect(signer, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => console.log('🔄 Token expired')
                });
                
                console.log('✅ Towns agent connected');
                setSetupComplete(true);

            } catch (error: any) {
                console.error('❌ Setup failed:', error);
                setSetupStep("Setup failed - please refresh");
                alert(`Setup failed: ${error.message}`);
            }
        };

        runSetup();
    }, [wallet, isAgentConnected, setupComplete, connect]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center max-w-md px-4">
                <h2 className="font-adonis text-3xl mb-4">Setting Up Your Membership</h2>
                <LoadingSpinner />
                <p className="font-georgia-pro text-sm text-gray-600 mt-4">
                    {setupStep}
                </p>
                {!setupStep.includes("failed") && (
                    <p className="font-georgia-pro text-xs text-gray-400 mt-2">
                        This usually takes 5-10 seconds
                    </p>
                )}
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
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━��━━━━━━━━━');
        }
    }, [space]);

    // Check if user needs to join (run once on mount)
    useEffect(() => {
        if (hasJoined || !wallet || !SAVED_SPACE_ID) return;

        const joinSpaceNow = async () => {
            try {
                const userAddress = wallet.getAccount()?.address;
                if (!userAddress) return;

                // ✅ WALLET-SPECIFIC: Include wallet address in localStorage key
                const hasJoinedBefore = localStorage.getItem(`joined_${JOIN_VERSION}_${SAVED_SPACE_ID}_${userAddress}`);
                
                if (hasJoinedBefore) {
                    console.log('✅ User already joined before (from localStorage v2)');
                    setSpaceId(SAVED_SPACE_ID);
                    setHasJoined(true);
                    return;
                }

                console.log('🚀 Joining space for the first time...');
                const signer = await getEthersV5Signer(wallet, activeChain, client);
                
                // ✅ Mint the NFT (don't skip)
                await joinSpace(SAVED_SPACE_ID, signer);
                
                console.log('✅ Join space successful!');
                // ✅ WALLET-SPECIFIC: Save with wallet address in key
                localStorage.setItem(`joined_${JOIN_VERSION}_${SAVED_SPACE_ID}_${userAddress}`, 'true');
                setSpaceId(SAVED_SPACE_ID);
                setHasJoined(true);

            } catch (error: any) {
                const userAddress = wallet.getAccount()?.address;
                
                if (error.message?.includes('already a member')) {
                    console.log('✅ Already a member - treating as success');
                    // ✅ WALLET-SPECIFIC: Save with wallet address in key
                    if (userAddress) {
                        localStorage.setItem(`joined_${JOIN_VERSION}_${SAVED_SPACE_ID}_${userAddress}`, 'true');
                    }
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
    const [hasSentWelcome, setHasSentWelcome] = useState(false);
    const { joinSpace } = useJoinSpace();
    const { data: space, isLoading: isSpaceLoading } = useSpace(SAVED_SPACE_ID || '');
    
    // ✅ Get channel and setup message hooks
    const channelId = space?.channelIds?.[0];
    const { data: timeline } = useTimeline(channelId || '');
    const { sendMessage, isPending: isSending } = useSendMessage(channelId || '');

    // Join space logic (existing)
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
                
                const hasJoinedBefore = localStorage.getItem(`bot_joined_${JOIN_VERSION}_${SAVED_SPACE_ID}_${botAddress}`);
                
                if (!hasJoinedBefore) {
                    console.log('🚀 Attempting to join space...');
                    console.log('   Towns SDK will mint membership NFT');
                    
                    await joinSpace(SAVED_SPACE_ID, connectedWallet);
                    
                    console.log('✅ Successfully joined space!');
                    localStorage.setItem(`bot_joined_${JOIN_VERSION}_${SAVED_SPACE_ID}_${botAddress}`, 'true');
                } else {
                    console.log('✅ Bot already joined space before (from localStorage v2)');
                }
                
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('✅ BOT JOINED SUCCESSFULLY!');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
                    
                    const { ethers } = await import('ethers-v5');
                    const privateKey = (window as any).KEY_SHARER_PRIVATE_KEY;
                    const botWallet = new ethers.Wallet(privateKey);
                    const botAddress = botWallet.address;
                    
                    localStorage.setItem(`bot_joined_${JOIN_VERSION}_${SAVED_SPACE_ID}_${botAddress}`, 'true');
                    setHasJoined(true);
                    return;
                }
                
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

    // ✅ NEW: Log space sync status
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

    // ✅ NEW: Monitor incoming messages
    useEffect(() => {
        if (!timeline || timeline.length === 0) return;

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📨 Bot received timeline update:');
        console.log('   Total messages:', timeline.length);
        console.log('   Latest message:', timeline[timeline.length - 1]);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }, [timeline]);

    // ✅ NEW: Send welcome message once when bot is ready
    useEffect(() => {
        if (!hasJoined || !channelId || hasSentWelcome || isSending) return;

        const sendWelcomeMessage = async () => {
            try {
                // Check if we already sent a welcome recently
                const lastWelcome = localStorage.getItem('bot_last_welcome');
                const now = Date.now();
                
                // Only send welcome if it's been more than 1 hour since last one
                if (lastWelcome && (now - parseInt(lastWelcome)) < 3600000) {
                    console.log('⏭️ Skipping welcome - sent recently');
                    setHasSentWelcome(true);
                    return;
                }

                console.log('🤖 Sending welcome message...');
                await sendMessage('🤖 Key Sharer Bot is online and monitoring the chat. I help ensure all members can access encrypted messages.');
                
                localStorage.setItem('bot_last_welcome', now.toString());
                setHasSentWelcome(true);
                console.log('✅ Welcome message sent!');
            } catch (error) {
                console.error('❌ Failed to send welcome message:', error);
            }
        };

        // Wait 3 seconds after joining before sending welcome
        const timer = setTimeout(sendWelcomeMessage, 3000);
        return () => clearTimeout(timer);
    }, [hasJoined, channelId, hasSentWelcome, isSending, sendMessage]);

    // ✅ NEW: Auto-respond to keywords (optional - for testing)
    useEffect(() => {
        if (!timeline || timeline.length === 0 || !channelId || isSending) return;

        const latestMessage = timeline[timeline.length - 1];
        const messageBody = latestMessage?.content?.body?.toLowerCase() || '';
        const messageId = latestMessage?.eventId;
        
        // Skip if we already responded to this message
        if (localStorage.getItem(`bot_responded_${messageId}`)) return;

        // Respond to specific keywords
        const shouldRespond = 
            messageBody.includes('!bot') || 
            messageBody.includes('!status') ||
            messageBody.includes('!help');

        if (shouldRespond) {
            const respond = async () => {
                try {
                    console.log('🤖 Detected command, responding...');
                    
                    let response = '';
                    if (messageBody.includes('!status')) {
                        response = `✅ Bot Status: Online | Messages in timeline: ${timeline.length} | Channel: ${channelId.substring(0, 8)}...`;
                    } else if (messageBody.includes('!help')) {
                        response = '🤖 Commands: !status (check bot status) | !help (this message)';
                    } else {
                        response = '👋 Key Sharer Bot here! Use !status or !help for more info.';
                    }

                    await sendMessage(response);
                    localStorage.setItem(`bot_responded_${messageId}`, 'true');
                    console.log('✅ Response sent!');
                } catch (error) {
                    console.error('❌ Failed to respond:', error);
                }
            };

            // Wait 1 second before responding
            setTimeout(respond, 1000);
        }
    }, [timeline, channelId, isSending, sendMessage]);

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

    // Wait for space to sync
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
                <p className="font-georgia-pro text-sm text-gray-600 mb-2">
                    Messages in timeline: {timeline?.length || 0}
                </p>
                <p className="font-georgia-pro text-xs text-gray-400">
                    Connected at {new Date().toLocaleTimeString()}
                </p>
                <p className="font-georgia-pro text-xs text-gray-500 mt-4">
                    💬 Monitoring chat for new messages...
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
