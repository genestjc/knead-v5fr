'use client';

import { useState, useEffect } from 'react';
import { TownsSyncProvider, useAgentConnection, useSpace } from '@towns-protocol/react-sdk';
import { ConnectButton, useActiveAccount } from 'thirdweb/react';
import { createTownsSigner } from '@/lib/towns-signer-adapter';
import { client, activeChain } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';

const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega');

export default function StandaloneChannelInspector() {
  return (
    <TownsSyncProvider>
      <InspectorContent />
    </TownsSyncProvider>
  );
}

function InspectorContent() {
  const account = useActiveAccount();
  const { connect, isAgentConnected } = useAgentConnection();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Auto-connect when wallet is ready
  useEffect(() => {
    if (!account || isAgentConnected || isConnecting) return;

    const connectAgent = async () => {
      setIsConnecting(true);
      setConnectionError(null);

      try {
        console.log('🔗 Connecting to Towns...');
        
        const signer = await createTownsSigner(account, client, activeChain);
        
        await connect(signer, { 
          townsConfig: TOWNS_CONFIG,
          onTokenExpired: () => console.log('⚠️ Token expired')
        });
        
        console.log('✅ Connected to Towns Protocol');
      } catch (error: any) {
        console.error('❌ Connection failed:', error);
        setConnectionError(error.message || 'Failed to connect');
      } finally {
        setIsConnecting(false);
      }
    };

    connectAgent();
  }, [account, isAgentConnected, isConnecting, connect]);

  // Not connected to wallet
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Channel ID Inspector</h1>
          <p className="font-georgia-pro text-gray-600 mb-6">
            Connect your wallet to view channel IDs
          </p>
          <ConnectButton 
            client={client}
            theme="light"
          />
        </div>
      </div>
    );
  }

  // Connecting to Towns
  if (isConnecting || !isAgentConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro mb-2">Connecting to Towns Protocol...</p>
          <p className="font-georgia-pro text-sm text-gray-500">
            Please sign the message in your wallet
          </p>
        </div>
      </div>
    );
  }

  // Connection error
  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <p className="font-georgia-pro text-red-600 mb-4">
            Failed to connect: {connectionError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ✅ Connected - show channels
  return <ChannelList />;
}

function ChannelList() {
  const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
  const { data: space, isLoading, error } = useSpace(spaceId);
  const [channels, setChannels] = useState<any[]>([]);

  useEffect(() => {
    if (space?.channelIds) {
      console.log('📋 All channel IDs:', space.channelIds);
      
      const channelList = space.channelIds.map((id: string, index: number) => ({
        index,
        id,
        name: `Channel ${index + 1}`,
      }));
      
      setChannels(channelList);
    }
  }, [space]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro">Loading space data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="font-georgia-pro text-red-600 mb-4">
            Error: {error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-adonis text-4xl mb-2">Channel ID Inspector</h1>
        <p className="font-georgia-pro text-gray-600 mb-8">
          Found {channels.length} channels in your space
        </p>

        {/* Channel List */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="font-adonis text-2xl mb-4">All Channels</h2>

          {channels.length === 0 ? (
            <p className="font-georgia-pro text-gray-500">No channels found</p>
          ) : (
            <div className="space-y-4">
              {channels.map((channel, idx) => (
                <div 
                  key={channel.id}
                  className="bg-gray-50 border border-gray-300 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-adonis text-lg mb-2">
                        Channel #{idx + 1}
                      </p>
                      
                      <div className="font-mono text-xs break-all text-gray-700 bg-white p-3 rounded border">
                        {channel.id}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(channel.id);
                        alert('Copied!');
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 whitespace-nowrap"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assignment Helper */}
        {channels.length >= 4 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h2 className="font-adonis text-2xl mb-4 text-green-800">
              📝 Copy All 4 Env Vars
            </h2>

            <div className="space-y-3">
              {[
                { key: 'NEXT_PUBLIC_CHANNEL_CONTRIBUTORS', idx: 0 },
                { key: 'NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A', idx: 1 },
                { key: 'NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B', idx: 2 },
                { key: 'NEXT_PUBLIC_CHANNEL_FILES', idx: 3 },
              ].map(({ key, idx }) => (
                <div key={key} className="bg-white p-3 rounded border">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-100 p-2 rounded break-all font-mono">
                      {key}={channels[idx]?.id}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${key}=${channels[idx]?.id}`);
                        alert('Copied!');
                      }}
                      className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                      📋
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => {
                  const all = `NEXT_PUBLIC_CHANNEL_CONTRIBUTORS=${channels[0]?.id}
NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A=${channels[1]?.id}
NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B=${channels[2]?.id}
NEXT_PUBLIC_CHANNEL_FILES=${channels[3]?.id}`;
                  navigator.clipboard.writeText(all);
                  alert('All 4 copied to clipboard!');
                }}
                className="w-full bg-green-600 text-white font-georgia-pro py-3 rounded-lg hover:bg-green-700"
              >
                📋 Copy All 4 Env Vars at Once
              </button>
            </div>

            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded p-4">
              <h3 className="font-adonis text-lg mb-2">⚠️ Next Steps</h3>
              <ol className="font-georgia-pro text-sm space-y-1 list-decimal list-inside">
                <li>Copy all 4 env vars above</li>
                <li>Go to Vercel → Settings → Environment Variables</li>
                <li>Add to Preview and Production</li>
                <li>Redeploy</li>
                <li>Set <code className="bg-yellow-100 px-1">isVirtualShardingEnabled()</code> to true</li>
              </ol>
            </div>
          </div>
        )}

        <div className="text-center mt-8">
          <a
            href="/admin"
            className="font-georgia-pro text-gray-600 hover:text-black underline"
          >
            ← Back to Admin
          </a>
        </div>
      </div>
    </div>
  );
}
