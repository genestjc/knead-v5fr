'use client';

import nextDynamic from 'next/dynamic';
import React, { useState } from 'react';

import { useAgentConnection, useCreateSpace, useSpace } from '@towns-protocol/react-sdk';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { viemAdapter } from 'thirdweb/adapters/viem';
import { client, activeChain } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { ethers } from 'ethers-v5';
import type { WalletClient } from 'viem';
import { Button } from '@/components/ui/button';

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

export default function ChatTestClient() {
    const [spaceId, setSpaceId] = useState<string | null>(null);
    const [isCreatingSpace, setIsCreatingSpace] = useState(false);

    const { connect, isAgentConnected, isAgentConnecting } = useAgentConnection();
    const { createSpace } = useCreateSpace();
    const wallet = useActiveWallet();
    const townsConfig = townsEnv().makeTownsConfig('omega');

    // Get space data to extract channel ID
    const { data: space } = useSpace(spaceId || '');
    const defaultChannelId = space?.channelIds?.[0]; // Default #general channel

    const currentUser = mockUser; 

    const handleConnectToTowns = async () => {
        if (!wallet) return;
        try {
          const viemWalletClient = viemAdapter.wallet. toViem({ 
            wallet, 
            client, 
            chain: activeChain 
          });
          const signer = await walletClientToSigner(viemWalletClient);
          if (! signer) throw new Error('Could not create signer.');
          await connect(signer, { townsConfig });
        } catch (e) {
          console.error("Failed to connect to Towns:", e);
          alert('Failed to connect to Towns. Check console for details.');
        }
    };

    const handleCreateSpace = async () => {
        if (!wallet) return;
        setIsCreatingSpace(true);
        try {
            const viemWalletClient = viemAdapter.wallet.toViem({ 
              wallet, 
              client, 
              chain: activeChain 
            });
            const signer = await walletClientToSigner(viemWalletClient);
            if (!signer) throw new Error('Could not create signer.');
            
            const result = await createSpace({ spaceName: 'Knead Chat Space' }, signer);
            console.log('✅ Space created:', result. spaceId);
            setSpaceId(result.spaceId);
        } catch (e) {
            console.error("❌ Failed to create space:", e);
            alert('Failed to create space. See console for details.');
        } finally {
            setIsCreatingSpace(false);
        }
    };
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            {isAgentConnected ?  (
                <>
                    {! spaceId ?  (
                        <div className="text-center max-w-md">
                            <h1 className="font-adonis text-4xl mb-4">Create Your Chat Space</h1>
                            <p className="font-georgia-pro text-lg mb-6 text-gray-600">
                                Create a Towns space to start chatting. 
                            </p>
                            <Button 
                                onClick={handleCreateSpace} 
                                disabled={isCreatingSpace}
                                className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition"
                            >
                                {isCreatingSpace ? 'Creating Space...' : 'Create Space'}
                            </Button>
                        </div>
                    ) : defaultChannelId ? (
                        <div className="w-full h-screen">
                            <ConnectedChat
                                currentUser={currentUser}
                                spaceId={spaceId}
                                defaultChannelId={defaultChannelId}
                            />
                        </div>
                    ) : (
                        <LoadingSpinner />
                    )}
                </>
            ) : (
                <div className="text-center max-w-md">
                    {!wallet ? (
                        <>
                            <h1 className="font-adonis text-4xl mb-4">Connect Your Wallet</h1>
                            <p className="font-georgia-pro text-lg mb-6 text-gray-600">
                                Connect your wallet to access Knead Chat.
                            </p>
                            <ConnectButton client={client} chain={activeChain} />
                        </>
                    ) : (
                        <>
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
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
