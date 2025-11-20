'use client';

import { useState, useEffect } from 'react';
import { useAgentConnection, useSpace } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { ethers } from 'ethers-v5';
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';

// Force dynamic rendering - don't pre-render at build time
export const dynamic = 'force-dynamic';

// Towns Protocol environment config
const townsConfig = townsEnv().makeTownsConfig('omega', {
  baseChainRpcUrl: process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL
});

const SPACE_ID = '463997';

// Separate component that only renders when connected
function SpaceInfo({ account }: { account: any }) {
  const { data: space, error: spaceError } = useSpace(SPACE_ID);

  // Log environment variables when space data is available
  useEffect(() => {
    if (space && space.channelIds && space.channelIds.length > 0) {
      console.log('='.repeat(60));
      console.log('📋 ENVIRONMENT VARIABLES TO COPY:');
      console.log('='.repeat(60));
      console.log(`NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=${SPACE_ID}`);
      console.log(`NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=${space.channelIds[0]}`);
      console.log('='.repeat(60));
    }
  }, [space]);

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-gray-50 rounded-lg p-8 shadow-lg mb-6">
          <h1 className="font-adonis text-4xl mb-6">Towns Protocol Space Info</h1>
          
          <div className="mb-6">
            <h2 className="font-adonis text-2xl mb-3">Connection Status</h2>
            <div className="bg-white rounded p-4 font-mono text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600">✓</span>
                <span>Connected to Towns Protocol (Omega)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Wallet: {account?.address.slice(0, 6)}...{account?.address.slice(-4)}</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="font-adonis text-2xl mb-3">Space ID</h2>
            <div className="bg-white rounded p-4 font-mono text-sm">
              <code className="text-blue-600">{SPACE_ID}</code>
            </div>
          </div>

          {spaceError && (
            <div className="mb-6">
              <h2 className="font-adonis text-2xl mb-3 text-red-600">Error</h2>
              <div className="bg-red-50 border border-red-200 rounded p-4 font-mono text-sm text-red-700">
                Failed to load space data. Check console for details.
              </div>
            </div>
          )}

          {!space && !spaceError && (
            <div className="mb-6">
              <h2 className="font-adonis text-2xl mb-3">Loading Space Data...</h2>
              <div className="bg-white rounded p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
              </div>
            </div>
          )}

          {space && (
            <>
              <div className="mb-6">
                <h2 className="font-adonis text-2xl mb-3">Space Metadata</h2>
                <div className="bg-white rounded p-4 font-mono text-sm">
                  <div className="mb-2">
                    <span className="text-gray-600">Name:</span>{' '}
                    <span className="font-semibold">{space.metadata?.name || 'Unnamed Space'}</span>
                  </div>
                  {space.metadata?.description && (
                    <div className="mb-2">
                      <span className="text-gray-600">Description:</span>{' '}
                      <span>{space.metadata.description}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h2 className="font-adonis text-2xl mb-3">Channel IDs</h2>
                <div className="bg-white rounded p-4">
                  {space.channelIds && space.channelIds.length > 0 ? (
                    <div>
                      <p className="font-georgia-pro text-sm text-gray-600 mb-3">
                        Found {space.channelIds.length} channel(s):
                      </p>
                      <ul className="space-y-2">
                        {space.channelIds.map((channelId, index) => (
                          <li key={channelId} className="font-mono text-sm bg-gray-50 p-3 rounded">
                            <span className="text-gray-600">Channel {index}:</span>{' '}
                            <code className="text-blue-600 font-semibold">{channelId}</code>
                            {index === 0 && (
                              <span className="ml-2 text-green-600 font-semibold">(Default)</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="font-georgia-pro text-gray-600">No channels found in this space.</p>
                  )}
                </div>
              </div>

              {space.channelIds && space.channelIds.length > 0 && (
                <div className="mb-6">
                  <h2 className="font-adonis text-2xl mb-3">Environment Variables</h2>
                  <div className="bg-gray-900 text-green-400 rounded p-4 font-mono text-sm">
                    <p className="mb-1">NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={SPACE_ID}</p>
                    <p>NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={space.channelIds[0]}</p>
                  </div>
                  <p className="font-georgia-pro text-sm text-gray-600 mt-2">
                    ℹ️ These values have also been logged to the browser console
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="font-georgia-pro text-sm text-blue-800">
                  ✨ <strong>Next Steps:</strong> Copy the environment variables above and add them to your Vercel project settings.
                  This is a temporary utility page that can be deleted after getting the channel ID.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GetSpaceInfoPage() {
  const [hasConnected, setHasConnected] = useState(false);
  const account = useActiveAccount();
  const connectionStatus = useActiveWalletConnectionStatus();
  const { connect, isAgentConnecting, isAgentConnected } = useAgentConnection();

  // Connect to Towns when wallet is connected
  useEffect(() => {
    if (!account?.address || isAgentConnected || isAgentConnecting || connectionStatus !== 'connected' || hasConnected) {
      return;
    }

    const connectToTowns = async () => {
      try {
        if (typeof window === 'undefined' || !window.ethereum) {
          console.error('No ethereum provider found');
          return;
        }

        const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
        const signer = provider.getSigner();

        await connect(signer, { townsConfig });
        console.log('✅ Connected to Towns Protocol');
        setHasConnected(true);
      } catch (err) {
        console.error('Failed to connect to Towns:', err);
      }
    };

    connectToTowns();
  }, [account?.address, isAgentConnected, isAgentConnecting, connectionStatus, connect, hasConnected]);

  const handleManualConnect = async () => {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        alert('No Web3 wallet detected. Please install MetaMask or another Web3 wallet.');
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
      const signer = provider.getSigner();
      await connect(signer, { townsConfig });
      setHasConnected(true);
    } catch (err) {
      console.error('Connection failed:', err);
      alert('Failed to connect to Towns Protocol. Check console for details.');
    }
  };

  // Not connected to wallet
  if (!account?.address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-2xl w-full bg-gray-50 rounded-lg p-8 shadow-lg">
          <h1 className="font-adonis text-4xl mb-4 text-center">Get Space Info</h1>
          <p className="font-georgia-pro text-lg mb-6 text-gray-600 text-center">
            Connect your wallet to fetch Towns Protocol space information
          </p>
          <div className="flex justify-center">
            <ThirdWebConnectButton />
          </div>
        </div>
      </div>
    );
  }

  // Wallet connected but Towns not authenticated
  if (!isAgentConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-2xl w-full bg-gray-50 rounded-lg p-8 shadow-lg">
          <h1 className="font-adonis text-3xl mb-4 text-center">Connecting to Towns Protocol...</h1>
          {isAgentConnecting ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
              <p className="font-georgia-pro text-gray-600">
                Please sign the message in your wallet to authenticate
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-georgia-pro text-gray-600 mb-6">
                Towns Protocol requires wallet signature for authentication
              </p>
              <button
                onClick={handleManualConnect}
                className="px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
              >
                Connect to Towns
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Connected to Towns - render SpaceInfo component
  return <SpaceInfo account={account} />;
}
