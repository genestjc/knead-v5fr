'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo } from 'react';
import { useAgentConnection, useCreateSpace, useJoinSpace, useSpace } from '@towns-protocol/react-sdk';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { Button } from '@/components/ui/button';
import { createWallet, inAppWallet, privateKeyToAccount } from 'thirdweb/wallets';
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
        // Small delay to ensure sync agent is fully propagated through context
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
    
    // Don't render inner component until agent is connected AND ready
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

// ✅ Inner component that uses Towns hooks
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
    const { isAgentConnected, connect } = useAgentConnection();

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

    // 🔑 Auto-login for headless key sharer (now inside connected component)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const privateKey = (window as any).KEY_SHARER_PRIVATE_KEY;
        const isAutoMode = (window as any).KEY_SHARER_AUTO_MODE;
        const alreadyAttempted = (window as any).KEY_SHARER_ATTEMPTED;
        
        if (!privateKey || !isAutoMode || alreadyAttempted) return;
        
        (window as any).KEY_SHARER_ATTEMPTED = true;
        console.log('🔑 KEY SHARER: Auto-login mode detected');
        
        autoConnectKeySharer(privateKey, connect, joinSpace);
    }, [connect, joinSpace]);

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

// ============================================
// 🔑 HEADLESS KEY SHARER AUTO-LOGIN FUNCTION
// ============================================
async function autoConnectKeySharer(privateKey: string, connect: any, joinSpace: any) {
    try {
        console.log('🔑 KEY SHARER: Starting auto-connection...');
        
        const account = privateKeyToAccount({ client, privateKey });
        console.log('✅ Account created:', account.address);
        
        const { ethers } = await import('ethers-v5');
        const provider = new ethers.providers.JsonRpcProvider(
            process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'
        );
        const wallet = new ethers.Wallet(privateKey, provider);
        console.log('✅ Ethers wallet created');
        
        console.log('🔑 KEY SHARER: Connecting to Towns Protocol...');
        await connect(wallet, { 
            townsConfig: TOWNS_CONFIG,
            onTokenExpired: () => {
                console.log('⚠️ KEY SHARER: Token expired');
            }
        });
        console.log('✅ Connected to Towns Protocol');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!SAVED_SPACE_ID) {
            throw new Error('Missing NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID');
        }
        
        console.log('🔑 KEY SHARER: Joining space:', SAVED_SPACE_ID);
        
        try {
            const fundResponse = await fetch('/api/towns/fund-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress: account.address }),
            });
            
            if (fundResponse.ok) {
                const fundData = await fundResponse.json();
                if (!fundData.alreadyFunded) {
                    console.log('⏳ Waiting for funding...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        } catch (fundError) {
            console.log('⚠️ Fund wallet failed, continuing anyway');
        }
        
        try {
            await joinSpace(SAVED_SPACE_ID, wallet, { skipMintMembership: false });
            console.log('✅ Joined space successfully');
        } catch (joinError: any) {
            if (joinError.message?.includes('already a member')) {
                console.log('✅ Already a member of space');
            } else {
                throw joinError;
            }
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🟢 KEY SHARER: FULLY CONNECTED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📡 Now sharing encryption keys with new members');
        console.log('⏰ Connected at:', new Date().toISOString());
        
        (window as any).KEY_SHARER_CONNECTED = true;
        
    } catch (error: any) {
        console.error('❌ KEY SHARER: Auto-login failed:', error);
        console.error(error);
        (window as any).KEY_SHARER_ERROR = error.message;
    }
}

export default function ChatTestClient() {
    const [isMounted, setIsMounted] = useState(false);
    const wallet = useActiveWallet();
    const { isAgentConnected, isAgentConnecting, connect } = useAgentConnection();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleConnectToTowns = async () => {
        if (!wallet) return;
        
        try {
            console.log('🔐 Connecting to Towns Protocol...');
            
            const signer = await getEthersV5Signer(wallet, activeChain, client);
            
            await connect(signer, { 
                townsConfig: TOWNS_CONFIG,
                onTokenExpired: () => {
                    console.log('⚠️ Token expired');
                }
            });
            
            console.log('✅ Connected to Towns');
            
        } catch (e: any) {
            console.error("Failed to connect:", e);
            alert(`Failed to connect: ${e.message}`);
        }
    };

    // 🔑 Show key sharer UI if in auto mode and connected
    if (typeof window !== 'undefined' && (window as any).KEY_SHARER_AUTO_MODE && isAgentConnected) {
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
                </div>
            </div>
        );
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
                <div className="text-center max-w-md">
                    <h1 className="font-adonis text-4xl mb-4">Connect to Towns</h1>
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
