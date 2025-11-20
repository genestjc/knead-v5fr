'use client';

import { useState } from 'react';
import { useCreateSpace } from '@towns-protocol/react-sdk';
import { ethers } from 'ethers-v5';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SpaceCreatorProps {
  walletAddress: string;
  onSpaceCreated: (spaceId: string, defaultChannelId: string) => void;
}

export default function SpaceCreator({ walletAddress, onSpaceCreated }: SpaceCreatorProps) {
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { createSpace, isPending } = useCreateSpace();

  const handleCreateSpace = async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask or use MetaMask browser');
      return;
    }

    setCreatingSpace(true);
    setError(null);

    try {
      console.log('🏗️ Starting space creation...');
      
      // Create provider from MetaMask
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      
      // Check current network
      const network = await provider.getNetwork();
      console.log('Current network:', network.chainId);

      // If not on Base mainnet (8453), switch to it
      if (network.chainId !== 8453) {
        console.log('Switching to Base mainnet...');
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }], // 8453 in hex
          });
        } catch (switchError: any) {
          // If Base mainnet is not added, add it with Alchemy RPC
          if (switchError.code === 4902) {
            console.log('Adding Base mainnet with Alchemy RPC...');
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: {
                  name: 'Ether',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL || 'https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org'],
              }],
            });
          } else {
            throw switchError;
          }
        }
        
        // Wait for network switch
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Refresh provider after network switch
      const baseProvider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = baseProvider.getSigner();
      
      const finalNetwork = await baseProvider.getNetwork();
      console.log('Creating space on Base mainnet (chainId:', finalNetwork.chainId, ')');

      // Use the Towns SDK hook
      const result = await createSpace({ spaceName: 'Knead' }, signer);
      
      console.log('✅ Knead space created:', result);
      console.log('📋 COPY THESE IDs:');
      console.log('   NEXT_PUBLIC_KNEAD_SPACE_ID=' + result.spaceId);
      console.log('   NEXT_PUBLIC_KNEAD_DEFAULT_CHANNEL_ID=' + result.defaultChannelId);
      
      // Save to Supabase
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
        console.error('⚠️ Failed to save to Supabase:', insertError);
      } else {
        console.log('✅ Space saved to Supabase');
      }
      
      alert('🎉 Space created! Check console for IDs to add to Vercel env vars.');
      
      onSpaceCreated(result.spaceId, result.defaultChannelId);
      
    } catch (err: any) {
      console.error('❌ Failed to create space:', err);
      const errorMessage = err.message || 'Failed to create Knead space';
      setError(errorMessage);
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
        <p className="font-georgia-pro text-sm text-gray-500 mb-4">
          This only needs to be done once - all users will join this space.
        </p>
        <p className="font-georgia-pro text-xs text-orange-600 mb-6">
          💡 Best results: Use MetaMask Mobile Browser
        </p>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="font-georgia-pro text-sm text-red-600">{error}</p>
          </div>
        )}

        {creatingSpace || isPending ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-600">
              Creating space... Please approve in MetaMask.
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
