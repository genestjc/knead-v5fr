'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useAgentConnection, useJoinSpace } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { ethers } from 'ethers';
import { ChannelCreator } from './ChannelCreator';

export default function AdminSetupContent() {
  const account = useActiveAccount();
  const [isConnectingTowns, setIsConnectingTowns] = useState(false);
  const [isJoiningSpace, setIsJoiningSpace] = useState(false);
  const [hasJoinedSpace, setHasJoinedSpace] = useState(false);
  
  const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
  
  const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL;
  
  useEffect(() => {
    console.log('🔗 RPC URL:', BASE_RPC_URL);
    if (!BASE_RPC_URL || BASE_RPC_URL.includes('mainnet.base.org')) {
      console.warn('⚠️ WARNING: Using public RPC! This WILL rate limit!');
    } else if (BASE_RPC_URL.includes('alchemy.com')) {
      console.log('✅ Using Alchemy RPC - good!');
    }
  }, [BASE_RPC_URL]);
  
  const townsConfig = BASE_RPC_URL 
    ? townsEnv().makeTownsConfig('omega', { rpcUrl: BASE_RPC_URL })
    : townsEnv().makeTownsConfig('omega');
  
  const { connect, isAgentConnected } = useAgentConnection();
  const { joinSpace } = useJoinSpace(spaceId);

  // Auto-connect to Towns when wallet is connected
  useEffect(() => {
    const connectToTowns = async () => {
      if (account && !isAgentConnected && !isConnectingTowns && typeof window !== 'undefined' && window.ethereum && connect) {
        setIsConnectingTowns(true);
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          
          console.log('🔗 Connecting to Towns with config:', townsConfig);
          
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
  }, [account, isAgentConnected, isConnectingTowns, connect, townsConfig]);

  // Auto-join space after Towns connection
  useEffect(() => {
    const joinTheSpace = async () => {
      if (isAgentConnected && !hasJoinedSpace && !isJoiningSpace && joinSpace) {
        setIsJoiningSpace(true);
        try {
          console.log('🏠 Joining space:', spaceId);
          
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          
          await joinSpace(signer);
          
          console.log('✅ Joined space successfully');
          setHasJoinedSpace(true);
        } catch (err: any) {
          // If already a member, that's fine
          if (err.message?.includes('already') || err.message?.includes('member')) {
            console.log('✅ Already a member of the space');
            setHasJoinedSpace(true);
          } else {
            console.error('Failed to join space:', err);
          }
        } finally {
          setIsJoiningSpace(false);
        }
      }
    };

    joinTheSpace();
  }, [isAgentConnected, hasJoinedSpace, isJoiningSpace, joinSpace, spaceId]);

  // Show loading until connected AND joined
  if (!isAgentConnected || !hasJoinedSpace) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="font-adonis text-5xl mb-2">Virtual Sharding Setup</h1>
        <p className="font-georgia-pro text-gray-600 mb-8">
          Setting up connection...
        </p>

        <div className="space-y-4">
          {/* Towns Connection Status */}
          <div className={`border rounded-lg p-6 ${
            isAgentConnected ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-center gap-2">
              {isAgentConnected ? (
                <>
                  <span className="text-green-600 text-xl">✅</span>
                  <span className="font-georgia-pro text-green-800">
                    Connected to Towns Protocol
                  </span>
                </>
              ) : (
                <>
                  <span className="animate-spin text-yellow-600 text-xl">⏳</span>
                  <span className="font-georgia-pro text-yellow-800">
                    Connecting to Towns Protocol...
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Space Join Status */}
          {isAgentConnected && (
            <div className={`border rounded-lg p-6 ${
              hasJoinedSpace ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'
            }`}>
              <div className="flex items-center gap-2">
                {hasJoinedSpace ? (
                  <>
                    <span className="text-green-600 text-xl">✅</span>
                    <span className="font-georgia-pro text-green-800">
                      Joined space as member
                    </span>
                  </>
                ) : (
                  <>
                    <span className="animate-spin text-yellow-600 text-xl">⏳</span>
                    <span className="font-georgia-pro text-yellow-800">
                      Joining space...
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* RPC Info */}
          <div className="mt-4 text-xs font-mono bg-gray-50 border border-gray-200 rounded p-3">
            <p className="text-gray-600">RPC Endpoint:</p>
            <p className={BASE_RPC_URL?.includes('alchemy') ? 'text-green-700' : 'text-red-700'}>
              {BASE_RPC_URL || '❌ Not set - will use public RPC (SLOW!)'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Only render ChannelCreator AFTER connected AND joined
  return <ChannelCreator spaceId={spaceId} rpcUrl={BASE_RPC_URL} />;
}
