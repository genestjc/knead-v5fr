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

// ✅ Main component for regular users
function TownsConnectedContent() {
    const [spaceId, setSpaceId] = useState<string | null>(SAVED_SPACE_ID || null);
    const [isJoiningSpace, setIsJoiningSpace] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);
    const [joinAttempted, setJoinAttempted] = useState(false);

    const wallet = useActiveWallet();
    const { connect, isAgentConnecting, isAgentConnected } = useAgentConnection();
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

    // ✅ Auto-trigger join flow when wallet is ready
    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).KEY_SHARER_AUTO_MODE) {
            return; // Skip for bot
        }
        
        if (SAVED_SPACE_ID && wallet && !hasJoined && !isJoiningSpace && !joinAttempted) {
            setJoinAttempted(true);
            handleJoinSpace(SAVED_SPACE_ID);
        }
    }, [wallet, hasJoined, isJoiningSpace, joinAttempted]);

    const handleJoinSpace = async (spaceIdToJoin: string) => {
        if (!wallet || isJoiningSpace) return;
        
        // Check if already joined
        const hasJoinedBefore = localStorage.getItem(`joined_${spaceIdToJoin}`);
        if (hasJoinedBefore && isAgentConnected) {
            console.log('✅ Previously joined space');
            setSpaceId(spaceIdToJoin);
            setHasJoined(true);
            return;
        }
        
        setIsJoiningSpace(true);
        
        try {
            const userAddress = wallet.getAccount()?.address;
            if (!userAddress) throw new Error('No wallet address');

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🚀 Starting join space flow');
            console.log('   User:', userAddress);
            console.log('   Space:', spaceIdToJoin);

            // ✅ STEP 1: Mint membership NFT
            console.log('📝 Step 1/4: Minting membership...');
            const mintResponse = await fetch('/api/towns/mint-membership', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress, spaceId: spaceIdToJoin }),
            });
            if (!mintResponse.ok) throw new Error('Membership minting failed');
            console.log('✅ Membership validated');

            // ✅ STEP 2: Fund wallet with ETH
            console.log('💰 Step 2/4: Funding wallet...');
            const fundResponse = await fetch('/api/towns/fund-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress }),
            });
            if (!fundResponse.ok) throw new Error('Failed to fund wallet');
            
            const fundData = await fundResponse.json();
            
            // ✅ STEP 3: Wait for funding to confirm ON-CHAIN
            if (!fundData.alreadyFunded) {
                console.log('⏳ Step 3/4: Waiting for funding confirmation...');
                
                const { ethers } = await import('ethers-v5');
                const provider = new ethers.providers.JsonRpcProvider(
                    process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'
                );
                
                let balanceConfirmed = false;
                for (let i = 0; i < 20; i++) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    const balance = await provider.getBalance(userAddress);
                    const balanceInEth = ethers.utils.formatEther(balance);
                    console.log(`   Balance check ${i + 1}/20: ${balanceInEth} ETH`);
                    
                    if (balance.gt(0)) {
                        console.log('✅ Funding confirmed! Balance:', balanceInEth, 'ETH');
                        balanceConfirmed = true;
                        break;
                    }
                }
                
                if (!balanceConfirmed) {
                    throw new Error('Funding did not confirm within 60 seconds');
                }
                
                // Extra buffer for network propagation
                console.log('   Adding 5-second buffer for network propagation...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
                console.log('✅ Step 3/4: Wallet already funded');
            }

            // ✅ STEP 4: Connect to Towns (NOW wallet has ETH!)
            if (!isAgentConnected) {
                console.log('🔐 Step 4/4: Connecting to Towns Protocol...');
                const ethersSigner = await getEthersV5Signer(wallet, activeChain, client);
                await connect(ethersSigner, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => console.log('⚠️ Token expired')
                });
                console.log('✅ Connected to Towns Protocol');
                
                // Small delay for connection to stabilize
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log('✅ Step 4/4: Already connected to Towns');
            }
            
            // ✅ STEP 5: Join space
            console.log('🚪 Joining space...');
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
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            setSpaceId(spaceIdToJoin);
            setHasJoined(true);
            
        } catch (error: any) {
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('❌ Failed to join space:', error);
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            alert(`Failed to join space: ${error.message}`);
            setJoinAttempted(false);
        } finally {
            setIsJoiningSpace(false);
        }
    };

    const channelId = space?.channelIds?.[0] || SAVED_CHANNEL_ID;

    // ✅ Show chat when everything is ready
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

    // ✅ Show loading during join process
    if (isJoiningSpace || isAgentConnecting) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center max-w-md space-y-6">
                    <div className="text-6xl mb-4">🔄</div>
                    <h1 className="font-adonis text-4xl mb-4">Setting up your chat...</h1>
                    <LoadingSpinner />
                    <p className="font-georgia-pro text-sm text-gray-500">
                        This may take up to a minute...
                    </p>
                </div>
            </div>
        );
    }

    // ✅ Show join button if not auto-joining
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center max-w-md space-y-6">
                <h1 className="font-adonis text-4xl mb-4">Join Knead Chat</h1>
                <Button 
                    onClick={() => handleJoinSpace(SAVED_SPACE_ID!)}
                    className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition w-full"
                >
                    Join Space
                </Button>
            </div>
        </div>
    );
}

// ✅ Key sharer bot component
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
                const { ethers } = await import('ethers-v5');
                const provider = new ethers.providers.JsonRpcProvider(
                    process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'
                );
                const privateKey = (window as any).KEY_SHARER_PRIVATE_KEY;
                const botWallet = new ethers.Wallet(privateKey, provider);
                const botAddress = botWallet.address;
                
                console.log('🔑 KEY SHARER: Bot wallet address:', botAddress);
                
                // Step 1: Mint membership
                console.log('🔑 KEY SHARER: Minting membership...');
                const mintResponse = await fetch('/api/towns/mint-membership', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress: botAddress, spaceId: SAVED_SPACE_ID }),
                });
                if (!mintResponse.ok) throw new Error('Membership minting failed');
                console.log('✅ KEY SHARER: Membership validated');
                
                // Step 2: Fund wallet
                console.log('🔑 KEY SHARER: Funding wallet...');
                const fundResponse = await fetch('/api/towns/fund-wallet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress: botAddress }),
                });
                if (!fundResponse.ok) throw new Error('Wallet funding failed');
                
                const fundData = await fundResponse.json();
                
                // Step 3: Wait for funding confirmation
                if (!fundData.alreadyFunded) {
                    console.log('🔑 KEY SHARER: Waiting for funding...');
                    
                    let balanceConfirmed = false;
                    for (let i = 0; i < 20; i++) {
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        const balance = await botWallet.getBalance();
                        const balanceInEth = ethers.utils.formatEther(balance);
                        console.log(`🔑 KEY SHARER: Balance check ${i + 1}/20: ${balanceInEth} ETH`);
                        
                        if (balance.gt(0)) {
                            console.log('✅ KEY SHARER: Funding confirmed!');
                            balanceConfirmed = true;
                            break;
                        }
                    }
                    
                    if (!balanceConfirmed) {
                        throw new Error('Funding timeout');
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
                // Step 4: Join space (Towns connection already happened in bot auto-login)
                console.log('🔑 KEY SHARER: Joining space...');
                await joinSpace(SAVED_SPACE_ID, botWallet, { skipMintMembership: false });
                console.log('✅ KEY SHARER: Joined successfully');
                setHasJoined(true);
                
            } catch (error: any) {
                if (error.message?.includes('already a member')) {
                    console.log('✅ KEY SHARER: Already a member');
                    setHasJoined(true);
                } else {
                    console.error('❌ KEY SHARER: Failed:', error.message);
                    setTimeout(() => setIsJoining(false), 20000);
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
                    <h1 className="font-adonis text-4xl mb-4">Key Sharer Joining...</h1>
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center max-w-md">
                <div className="text-6xl mb-4">🟢</div>
                <h1 className="font-adonis text-4xl mb-4">Key Sharer Online</h1>
                <p className="font-georgia-pro text-sm text-gray-400 mt-4">
                    Space: {SAVED_SPACE_ID?.substring(0, 20)}...
                </p>
            </div>
        </div>
    );
}

export default function ChatTestClient() {
    const [isMounted, setIsMounted] = useState(false);
    const [botAutoLoginAttempted, setBotAutoLoginAttempted] = useState(false);
    const wallet = useActiveWallet();
    const { isAgentConnected, connect } = useAgentConnection();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // 🔑 Bot auto-connect to Towns (bot wallet already has ETH from previous runs)
    useEffect(() => {
        if (!isMounted || botAutoLoginAttempted) return;
        if (typeof window === 'undefined') return;
        
        const privateKey = (window as any).KEY_SHARER_PRIVATE_KEY;
        const isAutoMode = (window as any).KEY_SHARER_AUTO_MODE;
        
        if (!privateKey || !isAutoMode) return;
        
        setBotAutoLoginAttempted(true);
        console.log('🔑 KEY SHARER: Auto-login mode detected');
        
        (async () => {
            try {
                const { ethers } = await import('ethers-v5');
                const provider = new ethers.providers.JsonRpcProvider(
                    process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'
                );
                const botWallet = new ethers.Wallet(privateKey, provider);
                console.log('✅ Bot wallet created:', botWallet.address);
                
                console.log('🔑 KEY SHARER: Connecting to Towns...');
                await connect(botWallet, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => console.log('⚠️ Token expired')
                });
                console.log('✅ Connected to Towns Protocol');
                
            } catch (error: any) {
                console.error('❌ Bot auto-login failed:', error);
            }
        })();
        
    }, [isMounted, botAutoLoginAttempted, connect]);

    // 🔑 Bot mode
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
        return <TownsConnectedContentKeySharer />;
    }

    // 👤 Regular user mode
    if (!isMounted) {
        return <LoadingSpinner />;
    }
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            {!wallet ? (
                <div className="text-center max-w-md">
                    <h1 className="font-adonis text-4xl mb-4">Connect Your Wallet</h1>
                    <ConnectButton client={client} chain={activeChain} wallets={wallets} />
                </div>
            ) : (
                <TownsConnectedContent />
            )}
        </div>
    );
}
