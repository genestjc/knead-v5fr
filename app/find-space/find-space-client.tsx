'use client';

import React from 'react';
import { 
  useAgentConnection, 
  useUserSpaces,
  useSpaceChannels
} from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { Button } from '@/components/ui/button';

import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { viemAdapter } from 'thirdweb/adapters/viem';
import { client, activeChain } from '@/thirdweb-client';

import { ethers } from 'ethers-v5';
import type { WalletClient } from 'viem';

// This function is correct.
function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  if (!account || !chain) return undefined;
  const network = { chainId: chain.id, name: chain.name, ensAddress: chain.contracts?.ensRegistry?.address };
  const provider = new ethers.providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}

// This component is correct.
function SpaceDetails({ spaceId }: { spaceId: string }) {
  const { data: channels, isLoading } = useSpaceChannels(spaceId);

  if (isLoading) return <p className="text-sm text-gray-500">Loading channels...</p>;

  return (
    <div className="mt-4 pl-4 border-l-2 border-gray-200">
      <h4 className="font-semibold text-gray-700">Channels in this Space:</h4>
      {channels && channels.length > 0 ? (
        <ul className="list-disc pl-5 mt-2 space-y-2">
          {channels.map(channel => (
            <li key={channel.id} className="text-sm">
              <span className="font-semibold">{channel.name}</span>
              <div className="text-xs text-gray-600 bg-gray-100 p-1 rounded font-mono break-all">
                Channel ID: {channel.id}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No channels found in this space.</p>
      )}
    </div>
  );
}

function ShowSpacesAndIds() {
  const { data: spaces, isLoading, error } = useUserSpaces();

  if (isLoading) return <div className="text-center p-8">Loading your spaces...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error.message}</div>;
  
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Your Space and Channel IDs</h1>
      <p className="mb-6">Copy the required IDs and paste them into your `.env.local` file.</p>
      {spaces && spaces.length > 0 ? (
        <div className="space-y-6">
          {spaces.map((space) => (
            <div key={space.id} className="p-4 border rounded-lg shadow-md bg-white">
              <h2 className="text-xl font-semibold">{space.name}</h2>
              <div className="text-sm text-gray-700 bg-blue-50 p-2 rounded mt-2 font-mono break-all">
                <strong>Space ID:</strong> {space.id}
              </div>
              <SpaceDetails spaceId={space.id} />
            </div>
          ))}
        </div>
      ) : (
        <p>You haven't joined any spaces yet. Make sure you are connected with the correct wallet.</p>
      )}
    </div>
  );
}

// The main component with all fixes applied
export default function FindSpaceClientComponent() {
  const { connect, isAgentConnected, isAgentConnecting } = useAgentConnection();
  const wallet = useActiveWallet();
  
  // --- THE FINAL FIX: Switched to 'omega' for mainnet configuration ---
  const townsConfig = townsEnv().makeTownsConfig('omega');

  const handleConnect = async () => {
    if (!wallet) return;
    try {
      const viemWalletClient = viemAdapter.wallet.toViem({ wallet, client, chain: activeChain });
      const signer = await walletClientToSigner(viemWalletClient);
      if (!signer) throw new Error('Could not create signer.');
      await connect(signer, { townsConfig });
    } catch (e) {
      console.error('Failed to connect to Towns:', e);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {isAgentConnected ? (
        <ShowSpacesAndIds />
      ) : (
        <div className="text-center">
          {!wallet ? (
            <div>
              <h1 className="text-3xl font-bold mb-4">Connect Your Wallet</h1>
              <p className="mb-4">Please connect your wallet to find your Space and Channel IDs.</p>
              <ConnectButton client={client} chain={activeChain} />
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold mb-4">Connect to Towns</h1>
              <p className="mb-4">Sign a message to load your Towns data.</p>
              <Button onClick={handleConnect} disabled={isAgentConnecting} className="px-6 py-3 bg-black text-white rounded-lg">
                {isAgentConnecting ? 'Connecting...' : 'Connect to Towns'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
