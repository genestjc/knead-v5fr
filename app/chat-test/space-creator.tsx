'use client';

import { useState } from 'react';
import { useCreateSpace } from '@towns-protocol/react-sdk';
import { ethers } from 'ethers-v5';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Base Mainnet configuration with custom Alchemy RPC
const BASE_MAINNET = {
  chainId: '0x2105', // 8453 in hex
  chainName: 'Base',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: [
    process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL || 'https://mainnet.base.org'
  ],
  blockExplorerUrls: ['https://basescan.org'],
};

interface SpaceCreatorProps {
  walletAddress: string;
  onSpaceCreated: (spaceId: string, defaultChannelId: string) => void;
}

export default function SpaceCreator({ walletAddress, onSpaceCreated }: SpaceCreatorProps) {
  const [creatingSpace, setCreatingSpace] = useState(false);
  const { createSpace, isPending: isCreatingSpace } = useCreateSpace();

  const handleCreateSpace = async () => {
    if (!window.ethereum) {
      alert('Please connect your wallet first');
      return;
    }

    setCreatingSpace(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      
      // Check current network
      const network = await provider.getNetwork();
      console.log('Current network:', network.chainId);

      // If not on Base mainnet (8453), switch to it
      if (network.chainId !== 8453) {
        console.log('Switching to Base mainnet...');
        try {
          // Try to switch to Base mainnet
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_MAINNET.chainId }],
          });
        } catch (switchError: any) {
          // If Base mainnet is not added, add it (with Alchemy RPC)
          if (switchError.code === 4902) {
            console.log('Adding Base mainnet to wallet with Alchemy RPC...');
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [BASE_MAINNET],
            });
          } else {
            throw switchError;
          }
        }
        
        // Wait a bit for network switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Get signer after network switch
      const signer = provider.getSigner();

      console.log('Creating Knead space on Base mainnet...');
      const result = await createSpace({ spaceName: 'Knead' }, signer);
      
      console.log('✅ Knead space created:', result);
      
      // Save to Supabase (global storage)
      const { error: insertError } = await supabase
        .from('towns_spaces')
        .insert({
          space_id: result.spaceId,
          space_name: 'Knead',
          default_channel_id: result.defaultChannelId,
          created_by: walletAddress,
          is_active: true,
        });

      if (insertError) {
        console.error('Failed to save space to Supabase:', insertError);
      } else {
        console.log('✅ Space saved to Supabase');
      }
      
      onSpaceCreated(result.spaceId, result.defaultChannelId);
    } catch (err) {
      console.error('Failed to create space:', err);
      alert('Failed to create Knead space. Check console for details.');
    } finally {
      setCreatingSpace(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-4">
        <h1 className="font-adonis text-4xl mb-4">Create Knead Space</h1>
        <p className="font-georgia-pro text-gray-600 mb-2">
          No Knead space exists yet. Create one to start the community!
        </p>
        <p className="font-georgia-pro text-sm text-gray-500 mb-6">
          This only needs to be done once - all users will join this space.
        </p>
        {creatingSpace || isCreatingSpace ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-600">
              Creating space... Please confirm the transaction in your wallet.
            </p>
          </>
        ) : (
          <button
            onClick={handleCreateSpace}
            className="px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
          >
            Create Knead Space
          </button>
        )}
      </div>
    </div>
  );
}
