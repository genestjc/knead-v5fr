'use client';

import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import React from 'react';

import { useAgentConnection } from '@towns-protocol/react-sdk';
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
            <p className="font-georgia-pro text-gray-600">Loading Chat...</p>
        </div>
    </div>
);

function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  if (!account || !chain) return undefined;
  
  const network = { chainId: chain.id, name: chain.name, ensAddress: chain.contracts?.ensRegistry?.address };
  const provider = new ethers.providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}

const mockUser = {
    id: 'user-123',
    alias: 'KneadUser',
    displayName: 'Knead User',
    membershipTier: 'Baker',
};

export default function ChatTestPage() {
    const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
    const defaultChannelId = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;

    // Use the correct hook properties
    const { connect, isAgentConnected, isAgentConnecting } = useAgentConnection();
    const wallet = useActiveWallet();
    // Point to the OMEGA mainnet
    const townsConfig = townsEnv().makeTownsConfig('omega');

    const currentUser = mockUser; 

    const handleConnectToTowns = async () => {
        if (!wallet) return;
        try {
          const viemWalletClient = viemAdapter.wallet.toViem({ wallet, client, chain: activeChain });
          const signer = await walletClientToSigner(viemWalletClient);
          if (!signer) throw new Error('Could not create signer.');
          await connect(signer, { townsConfig });
        } catch (e) {
          console.error("Failed to connect to Towns:", e);
        }
    };

    if (!spaceId || !defaultChannelId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white p-4">
                <div className="max-w-2xl w-full bg-yellow-50 rounded-lg p-8 text-center border border-yellow-200">
                    <h1 className="font-adonis text-4xl mb-4 text-yellow-800">Configuration Error</h1>
                    <p className="font-georgia-pro text-lg mb-6 text-yellow-900">
                        The chat environment variables are not set in your `.env.local` file.
                    </p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            {isAgentConnected ? (
                <div className="w-full h-full">
                    <ConnectedChat
                        currentUser={currentUser}
                        spaceId={spaceId}
                        defaultChannelId={defaultChannelId}
                    />
                </div>
            ) : (
                <div className="text-center">
                    {!wallet ? (
                        <>
                            <h1 className="font-adonis text-4xl mb-4">Connect Your Wallet</h1>
                            <p className="font-georgia-pro text-lg mb-6">Connect your wallet to access Knead Chat.</p>
                            <ConnectButton client={client} chain={activeChain} />
                        </>
                    ) : (
                        <>
                            <h1 className="font-adonis text-4xl mb-4">Connect to Towns</h1>
                            <p className="font-georgia-pro text-lg mb-6">Sign a message to enter the chat.</p>
                            <Button onClick={handleConnectToTowns} disabled={isAgentConnecting} className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition">
                                {isAgentConnecting ? 'Connecting...' : 'Connect to Towns'}
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
