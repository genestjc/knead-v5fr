'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo } from 'react';
import { useAgentConnection, useCreateSpace, useJoinSpace, useSpace } from '@towns-protocol/react-sdk';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { Button } from '@/components/ui/button';
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

// ✅ Wrapper component that checks agent connection with timing guard
function TownsConnectedContent() {
    const { isAgentConnected } = useAgentConnection();
    const [isReady, setIsReady] = useState(false);
    
    useEffect(() => {
        if (isAgentConnected) {
            const timer = setTimeout(() => {
                console.log('✅ Agent connected and ready, rendering Towns components');
                setIsReady(true);
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setIsReady(false);
        }
    }, [isAgentConnected]);
    
    if (!isAgentConnected || !isReady) {
        return (
            <div className="text-center max-w-md space-y-6">
                <h1 className="font-adonis text-4xl mb-4">Connecting...</h1>
                <LoadingSpinner />
            </div>
        );
    }
    
    return <TownsConnectedContentInner />;
}

// ✅ Inner component that uses Towns hooks (for regular users)
function TownsConnectedContentInner() {
    const [spaceId, setSpaceId] = useState<string | null>(SAVED_SPACE_ID || null);
    const [isCreatingSpace, setIsCreatingSpace] = useState(false);
    const [isJoiningSpace, setIsJoiningSpace] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);
    const [joinAttempted, setJoinAttempted] = useState(false);

    const wallet = useActiveWallet();
    const { createSpace } = useCreateSpace();
    const { joinSpace } = useJoinSpace();
    const { data: space } = useSpace(spaceId || '');
    const { isAgentConnected } = useAgentConnection();

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
        // Skip auto-join if in key sharer mode
        if (typeof window !== 'undefined' && (window as any).KEY_SHARER_AUTO_MODE) {
            return;
        }
        
        if (SAVED_SPACE_ID && !hasJoined && !isJoiningSpace && !joinAttempted) {
            setJoinAttempted(true);
            handleJoinSpace(SAVED_SPACE_ID);
        }
    }, [hasJoined, isJoiningSpace, joinAttempted]);

    const handleJoinSpace = async (spaceIdToJoin: string) => {
        if (!wallet || isJoiningSpace) return;
        
        if (space?.id === spaceIdToJoin) {
            console.log('✅ Space already loaded');
            setSpaceId(spaceIdToJoin);
            setHasJoined(true);
            return;
        }
        
        const hasJoinedBefore = localStorage.getItem(`joined_${spaceIdToJoin}`);
        if (hasJoinedBefore) {
            console.log('✅ Previously joined space');
            setSpaceId(spaceIdToJoin);
            setHasJoined(true);
            return;
        }
        
        setIsJoiningSpace(true);
        
        try {
            const userAddress = wallet.getAccount()?.address;
            if (!userAddress) throw new Error('No wallet address');

            console.log('🚪 Joining space:', spaceIdToJoin);

            const validateResponse = await fetch('/api/towns/mint-membership', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress, spaceId: spaceIdToJoin }),
            });
            if (!validateResponse.ok) throw new Error('Validation failed');

            const fundResponse = await fetch('/api/towns/fund-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress }),
            });
            if (!fundResponse.ok) throw new Error('Failed to fund wallet');
            
            const fundData = await fundResponse.json();
            if (!fundData.alreadyFunded) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            const ethersSigner = await getEthersV5Signer(wallet, activeChain, client);
            
            try {
                await joinSpace(spaceIdToJoin, ethersSigner, { skipMintMembership: false });
                console.log('✅ Joined space successfully');
                localStorage.setItem(`joined_${spaceIdToJoin}`, 'true');
            } catch (joinError: any) {
                if (joinError.message?.includes('already a member')) {
                    console.log('ℹ️ Already a member');
                    localStorage.setItem(`joined_${spaceIdToJoin}`, 'true');
                } else {
                    throw joinError;
                }
            }
            
            setSpaceId(spaceIdToJoin);
            setHasJoined(true);
            
        } catch (error: any) {
            console.error('❌ Failed to join space:', error);
            alert(`Failed to join space: ${error.message}`);
            setJoinAttempted(false);
        } finally {
            setIsJoiningSpace(false);
        }
    };

    const handleCreateSpace = async () => {
        if (!wallet) return;
        setIsCreatingSpace(true);
        
        try {
            const signer = await getEthersV5Signer(wallet, activeChain, client);
            const result = await createSpace({ spaceName: 'Knead Chat Space' }, signer);
            
            alert(
                `✅ Space Created!\n\n` +
                `NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=${result.spaceId}\n` +
                `NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=${result.defaultChannelId}`
            );

            await handleJoinSpace(result.spaceId);
        } catch (error: any) {
            console.error('❌ Failed to create space:', error);
            alert(`Failed to create space: ${error.message}`);
        } finally {
            setIsCreatingSpace(false);
        }
    };

    const channelId = space?.channelIds?.[0] || SAVED_CHANNEL_ID;

    if (hasJoined && spaceId && channelId && isAgentConnected && currentUser) {
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

    if (isJoiningSpace || !isAgentConnected) {
        return (
            <div className="text-center max-w-md space-y-6">
                <h1 className="font-adonis text-4xl mb-4">
                    {isJoiningSpace ? 'Joining Space...' : 'Connecting...'}
                </h1>
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="text-center max-w-md space-y-6">
            <h1 className="font-adonis text-4xl mb-4">
                {SAVED_SPACE_ID ? 'Join Knead Chat' : 'Create Your Chat Space'}
            </h1>
            
            {SAVED_SPACE_ID ? (
                <Button 
                    onClick={() => handleJoinSpace(SAVED_SPACE_ID)}
                    className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition w-full"
                >
                    Join Space
                </Button>
            ) : (
                <Button 
                    onClick={handleCreateSpace} 
                    disabled={isCreatingSpace}
                    className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition w-full"
                >
                    {isCreatingSpace ? 'Creating Space...' : 'Create Space'}
                </Button>
            )}
        </div>
    );
}

// ✅ Key sharer version that auto-joins space with funding
function TownsConnectedContentKeySharer() {
    const [hasJoined, setHasJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const { joinSpace } = useJoinSpace();
    const { isAgentConnected } = useAgentConnection();

    useEffect(() => {
        if (!SAVED_SPACE_ID || hasJoined || isJoining || !isAgentConnected) return;
        
        const joinAsBot = async () => {
            setIsJoining(true);
            console.log('🔑 KEY SHARER: Joining space as bot...');
            
            try {
                // Get bot wallet address
                const { ethers } = await import('ethers-v5');
                const provider = new ethers.providers.JsonRpcProvider(
                    process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'
                );
                const privateKey = (window as any).KEY_SHARER_PRIVATE_KEY;
                const botWallet = new ethers.Wallet(privateKey, provider);
                const botAddress = botWallet.address;
                
                console.log('🔑 KEY SHARER: Bot wallet address:', botAddress);
                
                // ✅ Step 1: Validate and mint membership NFT
                console.log('🔑 KEY SHARER: Minting membership...');
                const mintResponse = await fetch('/api/towns/mint-membership', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress: botAddress, spaceId: SAVED_SPACE_ID }),
                });
                
                if (!mintResponse.ok) {
                    throw new Error('Membership minting failed');
                }
                console.log('✅ KEY SHARER: Membership validated');
                
                // ✅ Step 2: Fund wallet with ETH for gas
                console.log('🔑 KEY SHARER: Funding wallet...');
                const fundResponse = await fetch('/api/towns/fund-wallet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress: botAddress }),
                });
                
                if (!fundResponse.ok) {
                    throw new Error('Wallet funding failed');
                }
                
                const fundData = await fundResponse.json();
                console.log('✅ KEY SHARER: Wallet funded:', fundData);
                
                // ✅ Step 3: Wait for funding to actually arrive and confirm
                if (!fundData.alreadyFunded) {
                    console.log('🔑 KEY SHARER: Waiting for funding to settle...');
                    
                    // Poll for balance every 2 seconds, max 30 seconds (15 attempts)
                    let balanceConfirmed = false;
                    for (let i = 0; i < 15; i++) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        try {
                            const balance = await botWallet.getBalance();
                            const balanceInEth = ethers.utils.formatEther(balance);
                            console.log(`🔑 KEY SHARER: Balance check ${i + 1}/15: ${balanceInEth} ETH`);
                            
                            if (balance.gt(0)) {
                                console.log('✅ KEY SHARER: Funding confirmed! Balance:', balanceInEth, 'ETH');
                                balanceConfirmed = true;
                                break;
                            }
                        } catch (balanceError) {
                            console.error('⚠️ KEY SHARER: Balance check failed:', balanceError);
                        }
                    }
                    
                    if (!balanceConfirmed) {
                        throw new Error('Funding transaction did not confirm within 30 seconds');
                    }
                } else {
                    // Still check balance to confirm
                    const balance = await botWallet.getBalance();
                    const balanceInEth = ethers.utils.formatEther(balance);
                    console.log('✅ KEY SHARER: Already funded. Current balance:', balanceInEth, 'ETH');
                }
                
                // ✅ Step 4: Join space
                console.log('🔑 KEY SHARER: Joining space...');
                await joinSpace(SAVED_SPACE_ID, botWallet, { skipMintMembership: false });
                console.log('✅ KEY SHARER: Joined space successfully');
                setHasJoined(true);
                
            } catch (error: any) {
                if (error.message?.includes('already a member')) {
                    console.log('✅ KEY SHARER: Already a member');
                    setHasJoined(true);
                } else {
                    console.error('❌ KEY SHARER: Failed to join space:', error);
                    console.error('❌ KEY SHARER: Error details:', error.message);
                    // Retry after 15 seconds (longer delay to avoid rate limits and allow funding)
                    setTimeout(() => setIsJoining(false), 15000);
                }
            }
        };
        
        joinAsBot();
    }, [isAgentConnected, hasJoined, isJoining, joinSpace]);

    if (!hasJoined) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">🔄</div>
                    <h1 className="font-adonis text-4xl mb-4">Key Sharer Joining Space...</h1>
                    <LoadingSpinner />
                    <p className="font-georgia-pro text-sm text-gray-400 mt-4">
                        Funding wallet and minting membership...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center max-w-md">
                <div className="text-6xl mb-4">🟢</div>
                <h1 className="font-adonis text-4xl mb-4">Key Sharer Online</h1>
                <p className="font-georgia-pro text-gray-600">
                    Sharing encryption keys with new members...
                </p>
                <p className="font-georgia-pro text-sm text-gray-400 mt-4">
                    Connected: {new Date().toLocaleTimeString()}
                </p>
                <p className="font-georgia-pro text-sm text-gray-400 mt-2">
                    Space: {SAVED_SPACE_ID?.substring(0, 20)}...
                </p>
            </div>
        </div>
    );
}

export default function ChatTestClient() {
    const [isMounted, setIsMounted] = useState(false);
    const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
    const [botAutoLoginAttempted, setBotAutoLoginAttempted] = useState(false);
    const wallet = useActiveWallet();
    const { isAgentConnected, isAgentConnecting, connect } = useAgentConnection();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // 🔑 Bot auto-login (runs BEFORE wallet checks)
    useEffect(() => {
        if (!isMounted || botAutoLoginAttempted) return;
        if (typeof window === 'undefined') return;
        
        const privateKey = (window as any).KEY_SHARER_PRIVATE_KEY;
        const isAutoMode = (window as any).KEY_SHARER_AUTO_MODE;
        
        if (!privateKey || !isAutoMode) return;
        
        setBotAutoLoginAttempted(true);
        (window as any).KEY_SHARER_ATTEMPTED = true;
        console.log('🔑 KEY SHARER: Auto-login mode detected');
        
        (async () => {
            try {
                console.log('🔑 KEY SHARER: Starting auto-connection...');
                
                const { ethers } = await import('ethers-v5');
                const provider = new ethers.providers.JsonRpcProvider(
                    process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'
                );
                const botWallet = new ethers.Wallet(privateKey, provider);
                console.log('✅ Bot wallet created:', botWallet.address);
                
                console.log('🔑 KEY SHARER: Connecting to Towns Protocol...');
                await connect(botWallet, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => console.log('⚠️ KEY SHARER: Token expired')
                });
                console.log('✅ Connected to Towns Protocol');
                
                (window as any).KEY_SHARER_CONNECTED = true;
                
            } catch (error: any) {
                console.error('❌ KEY SHARER: Auto-login failed:', error);
                (window as any).KEY_SHARER_ERROR = error.message;
            }
        })();
        
    }, [isMounted, botAutoLoginAttempted, connect]);

    // ✅ Regular user auto-connect to Towns when wallet is ready
    useEffect(() => {
        if (!isMounted || !wallet || isAgentConnected || isAgentConnecting || autoConnectAttempted) {
            return;
        }
        
        if (typeof window !== 'undefined' && (window as any).KEY_SHARER_AUTO_MODE) {
            return;
        }
        
        setAutoConnectAttempted(true);
        
        const autoConnect = async () => {
            try {
                console.log('🔐 Auto-connecting to Towns Protocol...');
                const signer = await getEthersV5Signer(wallet, activeChain, client);
                await connect(signer, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => console.log('⚠️ Token expired')
                });
                console.log('✅ Auto-connected to Towns');
            } catch (e: any) {
                console.error("❌ Auto-connect failed:", e);
                setAutoConnectAttempted(false);
            }
        };
        
        autoConnect();
    }, [isMounted, wallet, isAgentConnected, isAgentConnecting, autoConnectAttempted, connect]);

    const handleConnectToTowns = async () => {
        if (!wallet) return;
        
        try {
            console.log('🔐 Connecting to Towns Protocol...');
            const signer = await getEthersV5Signer(wallet, activeChain, client);
            await connect(signer, { 
                townsConfig: TOWNS_CONFIG,
                onTokenExpired: () => console.log('⚠️ Token expired')
            });
            console.log('✅ Connected to Towns');
        } catch (e: any) {
            console.error("Failed to connect:", e);
            alert(`Failed to connect: ${e.message}`);
        }
    };

    // 🔑 Show key sharer UI if in auto mode
    if (typeof window !== 'undefined' && (window as any).KEY_SHARER_AUTO_MODE) {
        if (!isAgentConnected) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-white">
                    <div className="text-center max-w-md">
                        <div className="text-6xl mb-4">🔄</div>
                        <h1 className="font-adonis text-4xl mb-4">Key Sharer Connecting...</h1>
                        <LoadingSpinner />
                    </div>
                </div>
            );
        }
        
        // ✅ Bot is connected, now let it join the space with funding
        return <TownsConnectedContentKeySharer />;
    }

    if (!isMounted || isAgentConnecting) {
        return <LoadingSpinner />;
    }
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            {!wallet ? (
                <div className="text-center max-w-md">
                    <h1 className="font-adonis text-4xl mb-4">Connect Your Wallet</h1>
                    <ConnectButton client={client} chain={activeChain} wallets={wallets} />
                </div>
            ) : !isAgentConnected ? (
                <div className="text-center max-w-md space-y-6">
                    <h1 className="font-adonis text-4xl mb-4">Connecting to Towns...</h1>
                    <LoadingSpinner />
                    <p className="font-georgia-pro text-sm text-gray-500">
                        This should only take a moment
                    </p>
                    <Button 
                        onClick={handleConnectToTowns} 
                        disabled={isAgentConnecting}
                        className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition"
                    >
                        Retry Connection
                    </Button>
                </div>
            ) : (
                <TownsConnectedContent />
            )}
        </div>
    );
}
