'use client';

import React from 'react';
import { useAgentConnection, useUserSpaces } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { Button } from '@/components/ui/button';

// Import hooks and adapters from Thirdweb
import { useActiveWallet } from 'thirdweb/react';
import { viemAdapter } from 'thirdweb/adapters/viem';

// Import ethers v5 and viem types for the conversion
import { providers } from 'ethers';
import type { WalletClient } from 'viem';
import { useThirdwebClient } from 'thirdweb/react';

// This helper converts a viem WalletClient to an ethers v5 Signer
// It does NOT use any hooks, so it's safe.
function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  if (!account || !chain) return undefined;
  
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  const provider = new providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}

// This component will only render AFTER a Towns connection is made
function ShowUserSpaces() {
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

// This is the main component for the page
export default function FindSpaceClientComponent() {
  const { connect, isConnected, isAgentConnecting } = useAgentConnection();
  
  const wallet = useActiveWallet();
  const client = useThirdwebClient(); // Get the thirdweb client instance
  
  const townsConfig = townsEnv().makeTownsConfig('gamma');

  const handleConnect = async () => {
    if (!wallet || !client) {
      alert('Please connect your web3 wallet first.');
      return;
    }
    try {
      // 1. Convert the thirdweb wallet to a viem WalletClient using the adapter
      const viemWalletClient = viemAdapter.wallet.toViem({ wallet, client });
      
      // 2. Convert the viem WalletClient to an ethers v5 signer
      const signer = walletClientToSigner(viemWalletClient);
      
      if (!signer) {
        throw new Error('Could not create a valid signer from the connected wallet.');
      }
      
      // 3. Connect to Towns with the correct signer
      await connect(signer, { townsConfig });
    } catch (e) {
      console.error('Failed to connect to Towns:', e);
      alert('Failed to connect to Towns. See console for details.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {isConnected ? (
        <ShowUserSpaces />
      ) : (
        <div>
          <h1 className="text-3xl font-bold mb-4">Connect to Towns</h1>
          <p className="mb-4">To see your spaces, you need to connect to the Towns Protocol.</p>
          <Button onClick={handleConnect} disabled={isAgentConnecting || !wallet}>
            {isAgentConnecting ? 'Connecting...' : 'Connect to Towns'}
          </Button>
          {!wallet && <p className="text-sm text-gray-500 mt-2">Please connect your main wallet first.</p>}
        </div>
      )}
    </div>
  );
}
