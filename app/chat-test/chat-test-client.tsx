'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';

import { useAgentConnection, useCreateSpace } from '@towns-protocol/react-sdk';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { viemAdapter } from 'thirdweb/adapters/viem';
import { client, activeChain } from '@/thirdweb-client'; // ✅ Import activeChain from your config
import { townsEnv } from '@towns-protocol/sdk';
import { ethers } from 'ethers-v5';
import type { WalletClient } from 'viem';
import { Button } from '@/components/ui/button';

// ✅ OMEGA = Base Mainnet
const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega');

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

// Inner component that uses Towns hooks - only renders when connected
function TownsConnectedContent() {
    const [spaceId, setSpaceId] = useState<string | null>(null);
    const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
    const [isCreatingSpace, setIsCreatingSpace] = useState(false);

    const wallet = useActiveWallet();
    
    // NOW it's safe to call these hooks because we're inside TownsSyncProvider
    // and only rendering when isAgentConnected is true
    const { createSpace } = useCreateSpace();

    const currentUser = mockUser;

    const handleCreateSpace = async () => {
        if (! wallet) return;
        setIsCreatingSpace(true);
        
        try {
            console.log('🚀 Creating space via Towns SDK on OMEGA (Base Mainnet)...');
            console.log('   - Network:  Base Mainnet (Chain ID 8453)');
            console.log('   - You should see MetaMask prompts to sign and approve');
            
            const viemWalletClient = viemAdapter. wallet. toViem({ 
              wallet, 
              client, 
              chain: activeChain // ✅ Use activeChain from config (Base Mainnet)
            });
            
            const signer = await walletClientToSigner(viemWalletClient);
            if (! signer) throw new Error('Could not create signer.');
            
            console.log('   - Signer created, requesting space creation...');
            
            // Use the Towns SDK createSpace method with user's signer
            const result = await createSpace(
                { spaceName: 'Knead Chat Space' }, 
                signer
            );

            console.log('✅ Space created successfully:', result);
            console.log('   - Space ID:', result.spaceId);
            console.log('   - Default Channel ID:', result.defaultChannelId);

            setSpaceId(result.spaceId);
            setDefaultChannelId(result.defaultChannelId);

        } catch (error:  any) {
            console.error('❌ Failed to create space:', error);
            
            // Give helpful error messages
            let errorMessage = error.message || 'Unknown error';
            
            if (errorMessage.includes('insufficient funds') || errorMessage.includes('gas')) {
                errorMessage = 'Insufficient Base ETH for gas fees.  Please add Base ETH to your wallet and try again.';
            } else if (errorMessage.includes('user rejected') || errorMessage.includes('denied')) {
                errorMessage = 'Transaction was rejected in MetaMask. ';
            } else if (errorMessage.includes('Factory__FailedDeployment') || errorMessage.includes('0x2b1c2246')) {
                errorMessage = 'Space deployment failed. Please ensure you\'re on Base Mainnet (not testnet) and have sufficient ETH.';
            }
            
            alert(`Failed to create space: ${errorMessage}`);
        } finally {
            setIsCreatingSpace(false);
        }
    };

    if (!spaceId) {
        return (
            <div className="text-center max-w-md">
                <h1 className="font-adonis text-4xl mb-4">Create Your Chat Space</h1>
                <p className="font-georgia-pro text-lg mb-6 text-gray-600">
                    Create a Towns space to start chatting. 
                </p>
                <p className="font-georgia-pro text-sm mb-2 text-gray-500">
                    Network: <strong>Base Mainnet (Chain ID: 8453)</strong>
                </p>
                <p className="font-georgia-pro text-sm mb-6 text-gray-500">
                    Note: You'll need Base ETH for gas fees (~0.01-0.05 ETH)
                </p>
                <Button 
                    onClick={handleCreateSpace} 
                    disabled={isCreatingSpace}
                    className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition"
                >
                    {isCreatingSpace ?  'Creating Space...' : 'Create Space'}
                </Button>
            </div>
        );
    }

    if (! defaultChannelId) {
        return (
            <div className="text-center">
                <LoadingSpinner />
                <p className="font-georgia-pro text-gray-600 mt-4">
                    Loading space data...
                </p>
            </div>
        );
    }

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

// Main component - handles wallet connection and Towns Protocol connection
export default function ChatTestClient() {
    const [isMounted, setIsMounted] = useState(false);
    
    const wallet = useActiveWallet();
    
    // These hooks are safe because they're designed to work without SyncAgent
    const { connect, isAgentConnected, isAgentConnecting } = useAgentConnection();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleConnectToTowns = async () => {
        if (!wallet) return;
        try {
          console.log('🔐 Connecting to Towns Protocol (OMEGA - Base Mainnet)...');
          console.log('   - Chain ID: 8453');
          console.log('   - You should see a MetaMask signature request');
          
          const viemWalletClient = viemAdapter.wallet.toViem({ 
            wallet, 
            client, 
            chain: activeChain // ✅ Use activeChain from config (Base Mainnet)
          });
          const signer = await walletClientToSigner(viemWalletClient);
          if (!signer) throw new Error('Could not create signer.');
          
          await connect(signer, { townsConfig: TOWNS_CONFIG });
          
          console.log('✅ Connected to Towns Protocol');
        } catch (e: any) {
          console. error("Failed to connect to Towns:", e);
          
          let errorMessage = e.message || 'Unknown error';
          if (errorMessage.includes('user rejected') || errorMessage.includes('denied')) {
            errorMessage = 'Signature request was rejected in MetaMask.';
          }
          
          alert(`Failed to connect to Towns: ${errorMessage}`);
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
                    <p className="font-georgia-pro text-sm mb-6 text-blue-600 font-semibold">
                        ⚠️ Make sure MetaMask is on Base Mainnet
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
                // Only render component with Towns hooks AFTER successful connection
                <TownsConnectedContent />
            )}
        </div>
    );
}
