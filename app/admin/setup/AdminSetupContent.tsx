'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { ethers } from 'ethers';
import { ChannelCreator } from './ChannelCreator';

export default function AdminSetupContent() {
  const account = useActiveAccount();
  const [isConnectingTowns, setIsConnectingTowns] = useState(false);
  
  const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
  
  // ✅ USE YOUR ALCHEMY RPC
  const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
  const townsConfig = townsEnv().makeTownsConfig('omega', {
    rpcUrl: BASE_RPC_URL,  // ← Your Alchemy endpoint
  });
  
  const { connect, isAgentConnected } = useAgentConnection();

  // Auto-connect to Towns when wallet is connected
  useEffect(() => {
    const connectToTowns = async () => {
      if (account && !isAgentConnected && !isConnectingTowns && typeof window !== 'undefined' && window.ethereum && connect) {
        setIsConnectingTowns(true);
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          
          console.log('🔗 Connecting to Towns with RPC:', BASE_RPC_URL);
          
          await connect(signer, { townsConfig });
          console.log('✅ Connected to Towns Protocol');
        } catch (err) {
          console.error('Failed to connect to Towns:', err);
        } finally {
          setIsConnectingTowns(false);
        }
      }
    };

    connectToTowns();
  }, [account, isAgentConnected, isConnectingTowns, connect, townsConfig, BASE_RPC_URL]);

  // Show loading until connected
  if (!isAgentConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="font-adonis text-5xl mb-2">Virtual Sharding Setup</h1>
        <p className="font-georgia-pro text-gray-600 mb-8">
          Connecting to Towns Protocol...
        </p>

        <div className="border rounded-lg p-6 bg-yellow-50 border-yellow-300">
          <div className="flex items-center gap-2">
            <span className="animate-spin text-yellow-600 text-xl">⏳</span>
            <span className="font-georgia-pro text-yellow-800">
              {account ? 'Connecting to Towns Protocol...' : 'Please connect your wallet first'}
            </span>
          </div>
          <p className="text-xs font-mono text-gray-600 mt-2">
            RPC: {BASE_RPC_URL.substring(0, 50)}...
          </p>
        </div>
      </div>
    );
  }

  // ✅ Only render ChannelCreator AFTER agent is connected
  return <ChannelCreator spaceId={spaceId} />;
}
