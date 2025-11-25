'use client';

import React from 'react';
import { useAgentConnection, useUserSpaces } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { Button } from '@/components/ui/button';

import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { viemAdapter } from 'thirdweb/adapters/viem';
import { client, activeChain } from '@/thirdweb-client'; // Import activeChain here too

// --- FIX BUILD WARNING ---
import { ethers } from 'ethers'; // Correct import for ethers v6
import type { WalletClient } from 'viem';

// Updated to use ethers.BrowserProvider for v6
function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  if (!account || !chain) return undefined;
  
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  const provider = new ethers.BrowserProvider(transport, network); // Use BrowserProvider
  const signer = provider.getSigner(account.address);
  return signer;
}

function ShowUserSpaces() {
  // This component does not need any changes
  const { data: spaces, isLoading, error } = useUserSpaces();

  if (isLoading) return <div className="text-center p-8">Loading your spaces...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error loading spaces: {error.message}</div>;
  
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Your Joined Spaces</h1>
      {spaces && spaces.length > 0 ? (
        <ul className="space-y-4">
          {spaces.map((space) => (
            <li key={space.id} className="p-4 border rounded-lg shadow">
              <h2 className="text-xl font-semibold">{space.name}</h2>
              <p className="text-gray-600">{space.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>You haven't joined any spaces yet.</p>
      )}
    </>
  );
}

export default function FindSpaceClientComponent() {
  const { connect, isConnected, isAgentConnecting } = useAgentConnection();
  const wallet = useActiveWallet();
  const townsConfig = townsEnv().makeTownsConfig('gamma');

  const handleConnect = async () => {
    if (!wallet) {
      alert('Wallet not detected. Please ensure your wallet is connected.');
      return;
    }
    try {
      const viemWalletClient = viemAdapter.wallet.toViem({ wallet, client, chain: activeChain });
      const signer = await walletClientToSigner(viemWalletClient);
      
      if (!signer) throw new Error('Could not create a valid signer.');
      
      await connect(signer, { townsConfig });
    } catch (e) {
      console.error('Failed to connect to Towns:', e);
      alert(`Failed to connect to Towns: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {isConnected ? (
        <ShowUserSpaces />
      ) : (
        <div>
          {!wallet ? (
            <div>
              <h1 className="text-3xl font-bold mb-4">Connect Your Wallet</h1>
              <p className="mb-4">Please connect your wallet to continue to Towns.</p>
              <ConnectButton client={client} chain={activeChain} />
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold mb-4">Connect to Towns</h1>
              <p className="mb-4">Your wallet is connected. Now, sign a message to connect to the Towns Protocol.</p>
              <Button onClick={handleConnect} disabled={isAgentConnecting}>
                {isAgentConnecting ? 'Connecting...' : 'Connect to Towns'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
