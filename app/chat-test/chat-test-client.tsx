'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';

import { useAgentConnection, useCreateSpace } from '@towns-protocol/react-sdk';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { viemAdapter } from 'thirdweb/adapters/viem';
import { client, activeChain } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { ethers } from 'ethers-v5';
import type { WalletClient } from 'viem';
import { Button } from '@/components/ui/button';

// ✅ Get saved space from env vars
const SAVED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
const SAVED_CHANNEL_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;
const TOWNS_NETWORK = process.env. NEXT_PUBLIC_TOWNS_NETWORK || 'omega';

// ✅ OMEGA = Base Mainnet
const TOWNS_CONFIG = townsEnv().makeTownsConfig(TOWNS_NETWORK as 'omega' | 'gamma');

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
    // ✅ Initialize with saved space ID from env
    const [spaceId, setSpaceId] = useState<string | null>(SAVED_SPACE_ID || null);
    const [defaultChannelId, setDefaultChannelId] = useState<string | null>(
        SAVED_CHANNEL_ID || SAVED_SPACE_ID || null
    );
    const [isCreatingSpace, setIsCreatingSpace] = useState(false);
    const [manualSpaceId, setManualSpaceId] = useState('');

    const wallet = useActiveWallet();
    const { createSpace } = useCreateSpace();
    const currentUser = mockUser;

    // ✅ Auto-enter chat if we have saved space ID
    useEffect(() => {
        if (SAVED_SPACE_ID) {
            console.log('✅ Using saved space:', SAVED_SPACE_ID);
            setSpaceId(SAVED_SPACE_ID);
            setDefaultChannelId(SAVED_CHANNEL_ID || SAVED_SPACE_ID);
        }
    }, []);

    const handleCreateSpace = async () => {
        if (!wallet) return;
        setIsCreatingSpace(true);
        
        try {
            console.log(`🚀 Creating space via Towns SDK on ${TOWNS_NETWORK. toUpperCase()}...`);
            console.log('   - Network:', TOWNS_NETWORK === 'omega' ? 'Base Mainnet (8453)' : 'Base Sepolia (84532)');
            console.log('   - You should see MetaMask prompts to sign and approve');
            
            const viemWalletClient = viemAdapter. wallet.toViem({ 
              wallet, 
              client, 
              chain: activeChain
            });
            
            const signer = await walletClientToSigner(viemWalletClient);
            if (!signer) throw new Error('Could not create signer.');
            
            console.log('   - Signer created, requesting space creation...');
            
            const result = await createSpace(
                { spaceName: 'Knead Chat Space' }, 
                signer
            );

            console.log('✅ Space created successfully:', result);
            console.log('   - Space ID:', result.spaceId);
            console.log('   - Default Channel ID:', result.defaultChannelId);
            console.log('📋 Add to . env. local:');
            console.log(`   NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=${result.spaceId}`);
            console.log(`   NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=${result.defaultChannelId}`);

            setSpaceId(result.spaceId);
            setDefaultChannelId(result.defaultChannelId);

        } catch (error:  any) {
            console.error('❌ Failed to create space:', error);
            
            if (error.message?. includes('nonce') || error.code === -32603) {
                alert(
                    '⚠️ Transaction may have succeeded despite the error.\n\n' +
                    'Check BaseScan for your transaction and enter the Space ID manually if needed.'
                );
            } else {
                alert(`Failed to create space: ${error.message}`);
            }
        } finally {
            setIsCreatingSpace(false);
        }
    };

    const handleManualSpaceId = () => {
        if (manualSpaceId.trim()) {
            setSpaceId(manualSpaceId. trim());
            setDefaultChannelId(manualSpaceId. trim());
        }
    };

    // ✅ If we have a space ID, go straight to chat
    if (spaceId && defaultChannelId) {
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

    // ✅ Otherwise show space creation/entry UI
    return (
        <div className="text-center max-w-md space-y-6">
            <h1 className="font-adonis text-4xl mb-4">
                {SAVED_SPACE_ID ? 'Enter Knead Chat' : 'Create Your Chat Space'}
            </h1>
            
            {SAVED_SPACE_ID ?  (
                <>
                    <p className="font-georgia-pro text-lg mb-6 text-gray-600">
                        Loading saved space:  <code className="bg-gray-100 px-2 py-1 rounded">{SAVED_SPACE_ID}</code>
                    </p>
                    <LoadingSpinner />
                </>
            ) : (
                <>
                    <p className="font-georgia-pro text-lg mb-6 text-gray-600">
                        Create a Towns space to start chatting. 
                    </p>
                    <p className="font-georgia-pro text-sm mb-2 text-gray-500">
                        Network: <strong>{TOWNS_NETWORK === 'omega' ? 'Base Mainnet (8453)' : 'Base Sepolia (84532)'}</strong>
                    </p>
                    <p className="font-georgia-pro text-sm mb-6 text-gray-500">
                        Note: You'll need Base ETH for gas fees (~0.01-0.05 ETH)
                    </p>
                    
                    <Button 
                        onClick={handleCreateSpace} 
                        disabled={isCreatingSpace}
                        className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition w-full"
                    >
                        {isCreatingSpace ?  'Creating Space...' : 'Create Space'}
                    </Button>

                    {/* Manual Space ID Entry */}
                    <div className="border-t pt-6 mt-6">
                        <p className="font-georgia-pro text-sm text-gray-600 mb-3">
                            Already created a space? Enter Space ID manually:
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={manualSpaceId}
                                onChange={(e) => setManualSpaceId(e.target.value)}
                                placeholder="Enter Space ID (e.g., 464398)"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            />
                            <Button
                                onClick={handleManualSpaceId}
                                disabled={! manualSpaceId.trim()}
                                variant="outline"
                                className="px-6"
                            >
                                Use Space
                            </Button>
                        </div>
                        <p className="font-georgia-pro text-xs text-gray-500 mt-2">
                            Find your Space ID in the BaseScan transaction logs
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

// Main component - handles wallet connection and Towns Protocol connection
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
          console.log(`🔐 Connecting to Towns Protocol (${TOWNS_NETWORK.toUpperCase()})...`);
          console.log('   - Chain ID:', activeChain.id);
          console.log('   - You should see a MetaMask signature request');
          
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
          alert(`Failed to connect to Towns:  ${e.message}`);
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
                        ⚠️ Make sure MetaMask is on {TOWNS_NETWORK === 'omega' ? 'Base Mainnet' : 'Base Sepolia'}
                    </p>
                    <ConnectButton client={client} chain={activeChain} />
                </div>
            ) : !isAgentConnected ?  (
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
