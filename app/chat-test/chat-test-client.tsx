'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';

import { useAgentConnection, useCreateSpace, useJoinSpace } from '@towns-protocol/react-sdk';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { viemAdapter } from 'thirdweb/adapters/viem';
import { client, activeChain } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { ethers } from 'ethers-v5';
import type { WalletClient } from 'viem';
import { Button } from '@/components/ui/button';

const SAVED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
const SAVED_CHANNEL_ID = process.env. NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;

const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega');
const NETWORK_NAME = 'Base Mainnet';

const ConnectedChat = nextDynamic(() => import('./connected-chat'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-600">Loading... </p>
        </div>
    </div>
);

function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  if (!account || !chain) return undefined;
  
  const network = { 
    chainId: chain.id, 
    name: chain.name, 
    ensAddress: chain.contracts?.ensRegistry?.address 
  };
  const provider = new ethers.providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account. address);
  return signer;
}

const mockUser = {
    id: 'user-123',
    alias: 'KneadUser',
    displayName: 'Knead User',
    membershipTier: 'Baker',
};

function TownsConnectedContent() {
    const [spaceId, setSpaceId] = useState<string | null>(SAVED_SPACE_ID || null);
    const [defaultChannelId, setDefaultChannelId] = useState<string | null>(
        SAVED_CHANNEL_ID || SAVED_SPACE_ID || null
    );
    const [isCreatingSpace, setIsCreatingSpace] = useState(false);
    const [isJoiningSpace, setIsJoiningSpace] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);
    const [manualSpaceId, setManualSpaceId] = useState('');

    const wallet = useActiveWallet();
    const { createSpace } = useCreateSpace(); // ✅ Use SDK hook
    const { joinSpace } = useJoinSpace();
    const currentUser = mockUser;

    useEffect(() => {
        if (SAVED_SPACE_ID && ! hasJoined && !isJoiningSpace) {
            handleJoinSpace(SAVED_SPACE_ID);
        }
    }, [hasJoined, isJoiningSpace]);

    const handleJoinSpace = async (spaceIdToJoin: string) => {
        if (! wallet) return;
        setIsJoiningSpace(true);
        
        try {
            console.log('🚪 Joining space:', spaceIdToJoin);
            
            const viemWalletClient = viemAdapter.wallet.toViem({ 
                wallet, 
                client, 
                chain: activeChain
            });
            const signer = await walletClientToSigner(viemWalletClient);
            if (!signer) throw new Error('Could not create signer.');
            
            await joinSpace(spaceIdToJoin, signer);
            
            console.log('✅ Joined space successfully');
            setSpaceId(spaceIdToJoin);
            setDefaultChannelId(spaceIdToJoin);
            setHasJoined(true);
            
        } catch (error:  any) {
            console.error('❌ Failed to join space:', error);
            alert(`Failed to join space: ${error. message}`);
        } finally {
            setIsJoiningSpace(false);
        }
    };

    const handleCreateSpace = async () => {
        if (!wallet) return;
        setIsCreatingSpace(true);
        
        try {
            console.log(`🚀 Creating space on ${NETWORK_NAME}...`);
            
            const viemWalletClient = viemAdapter.wallet.toViem({ 
              wallet, 
              client, 
              chain: activeChain
            });
            
            const signer = await walletClientToSigner(viemWalletClient);
            if (!signer) throw new Error('Could not create signer.');
            
            // ✅ Use SDK hook - it handles all the config internally
            const result = await createSpace(
                { spaceName: 'Knead Chat Space' }, 
                signer
            );

            console.log('✅ Space created successfully:', result);
            console.log('   - Space ID:', result.spaceId);
            console.log('   - Default Channel ID:', result. defaultChannelId);
            console.log('📋 Add to . env. local:');
            console.log(`NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=${result.spaceId}`);
            console.log(`NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=${result.defaultChannelId}`);
            console.log(`NEXT_PUBLIC_TOWNS_NETWORK=omega`);
            
            alert(
                `✅ Space Created!\n\n` +
                `Space ID: ${result.spaceId}\n\n` +
                `Copy these to your .env.local:\n\n` +
                `NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=${result.spaceId}\n` +
                `NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=${result. defaultChannelId}\n` +
                `NEXT_PUBLIC_TOWNS_NETWORK=omega`
            );

            // Try to auto-join
            await handleJoinSpace(result.spaceId);

        } catch (error: any) {
            console. error('❌ Failed to create space:', error);
            alert(`Failed to create space: ${error. message}`);
        } finally {
            setIsCreatingSpace(false);
        }
    };

    const handleManualSpaceId = () => {
        if (manualSpaceId.trim()) {
            handleJoinSpace(manualSpaceId. trim());
        }
    };

    if (hasJoined && spaceId && defaultChannelId) {
        return (
            <div className="w-full h-screen">
                <ConnectedChat
                    currentUser={currentUser}
                    spaceId={spaceId}
                    defaultChannelId={defaultChannelId}
                />
            </div>
        );
    }

    if (isJoiningSpace) {
        return (
            <div className="text-center max-w-md space-y-6">
                <h1 className="font-adonis text-4xl mb-4">Joining Space...</h1>
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="text-center max-w-md space-y-6">
            <h1 className="font-adonis text-4xl mb-4">
                {SAVED_SPACE_ID ? 'Join Knead Chat' : 'Create Your Chat Space'}
            </h1>
            
            {SAVED_SPACE_ID ?  (
                <>
                    <p className="font-georgia-pro text-lg mb-6 text-gray-600">
                        Space ID: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{SAVED_SPACE_ID}</code>
                    </p>
                    <Button 
                        onClick={() => handleJoinSpace(SAVED_SPACE_ID)}
                        className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition w-full"
                    >
                        Join Space
                    </Button>
                </>
            ) : (
                <>
                    <p className="font-georgia-pro text-lg mb-6 text-gray-600">
                        Create a Towns space to start chatting. 
                    </p>
                    
                    <Button 
                        onClick={handleCreateSpace} 
                        disabled={isCreatingSpace}
                        className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition w-full"
                    >
                        {isCreatingSpace ? 'Creating Space...' : 'Create Space'}
                    </Button>

                    <div className="border-t pt-6 mt-6">
                        <p className="font-georgia-pro text-sm text-gray-600 mb-3">
                            Already have a space? Enter Space ID: 
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={manualSpaceId}
                                onChange={(e) => setManualSpaceId(e.target.value)}
                                placeholder="Enter Space ID"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            />
                            <Button
                                onClick={handleManualSpaceId}
                                disabled={! manualSpaceId.trim()}
                                variant="outline"
                                className="px-6"
                            >
                                Join
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default function ChatTestClient() {
    const [isMounted, setIsMounted] = useState(false);
    
    const wallet = useActiveWallet();
    const { connect, isAgentConnected, isAgentConnecting } = useAgentConnection();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleConnectToTowns = async () => {
        if (!wallet) return;
        try {
          console.log(`🔐 Connecting to Towns Protocol (omega)...`);
          
          const viemWalletClient = viemAdapter.wallet.toViem({ 
            wallet, 
            client, 
            chain: activeChain
          });
          const signer = await walletClientToSigner(viemWalletClient);
          if (!signer) throw new Error('Could not create signer.');
          
          await connect(signer, { townsConfig: TOWNS_CONFIG });
          
          console.log('✅ Connected to Towns Protocol');
        } catch (e:  any) {
          console.error("Failed to connect to Towns:", e);
          alert(`Failed to connect to Towns: ${e.message}`);
        }
    };

    if (!isMounted || isAgentConnecting) {
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
