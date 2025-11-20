'use client';

import { useState, useEffect } from 'react';
import { TownsSyncProvider, signAndConnect, useCreateSpace } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import type { SyncAgent } from '@towns-protocol/sdk';
import { ethers } from 'ethers-v5';
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';

// Inner component that uses Towns hooks (must be inside TownsSyncProvider)
function CreateSpaceForm({ 
  onSpaceCreated 
}: { 
  onSpaceCreated: (spaceId: string, channelId: string) => void 
}) {
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: createSpace, isPending: isCreating } = useCreateSpace();

  const handleCreateSpace = async () => {
    setError(null);
    
    try {
      if (!window.ethereum) {
        throw new Error('Please install MetaMask or a Web3 wallet');
      }

      console.log('🚀 Creating Knead Chat space...');
      console.log('📍 Network: Base Mainnet (Omega)');
      
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      
      const result = await createSpace({
        spaceName: 'Knead Chat',
        signer
      });

      console.log('✅ Space created successfully!');
      console.log('📋 Space ID:', result.spaceId);
      console.log('📋 Default Channel ID:', result.defaultChannelId);

      onSpaceCreated(result.spaceId, result.defaultChannelId);

    } catch (err: any) {
      console.error('❌ Error creating space:', err);
      setError(err.message || 'Failed to create space');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-2xl w-full bg-gray-50 rounded-lg p-8 text-center">
        <h1 className="font-adonis text-4xl mb-4">Create Knead Chat Space</h1>
        <p className="font-georgia-pro text-lg mb-4 text-gray-600">
          Click below to create your Towns Protocol space for Knead Chat.
        </p>
        <p className="font-georgia-pro text-sm mb-8 text-gray-500">
          This will mint a Space NFT to your wallet on Base mainnet. You only need to do this once.
        </p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
            ❌ {error}
          </div>
        )}
        
        <button
          onClick={handleCreateSpace}
          disabled={isCreating}
          className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {isCreating ? '⏳ Creating Space...' : '🚀 Create Knead Chat Space'}
        </button>
        
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
          <p className="font-georgia-pro text-sm text-yellow-800">
            <strong>ℹ️ Note:</strong> This will create a new space on Towns Protocol. If you already have a space, 
            you can find its ID in the Towns app settings.
          </p>
        </div>
      </div>
    </div>
  );
}

// Main component
export default function SetupTownsContent() {
  const [mounted, setMounted] = useState(false);
  const [spaceCreated, setSpaceCreated] = useState<{ spaceId: string; channelId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncAgent, setSyncAgent] = useState<SyncAgent | undefined>(undefined);
  const account = useActiveAccount();
  const connectionStatus = useActiveWalletConnectionStatus();

  // Ensure client-side only rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-connect to Towns when wallet connects
  useEffect(() => {
    if (!mounted || !account?.address || syncAgent || connectionStatus !== 'connected') return;

    const connectToTowns = async () => {
      setIsConnecting(true);
      setError(null);
      
      try {
        if (!window.ethereum) {
          throw new Error('No Web3 wallet detected');
        }
        
        console.log('🔌 Connecting to Towns Protocol...');
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();
        
        // Create Towns config inside the function
        const townsConfig = townsEnv().makeTownsConfig('omega', {
          baseChainRpcUrl: 'https://mainnet.base.org'
        });
        
        console.log('Towns config created:', townsConfig);
        
        // Use signAndConnect with the config
        const agent = await signAndConnect(signer, townsConfig);
        
        console.log('✅ Connected to Towns Protocol');
        setSyncAgent(agent);
      } catch (err: any) {
        console.error('❌ Towns connection error:', err);
        setError(`Connection failed: ${err.message}`);
      } finally {
        setIsConnecting(false);
      }
    };

    connectToTowns();
  }, [mounted, account?.address, connectionStatus, syncAgent]);

  // Don't render until mounted (client-side only)
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  // Not connected to wallet
  if (!account?.address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-2xl w-full bg-gray-50 rounded-lg p-8 text-center">
          <h1 className="font-adonis text-4xl mb-4">Setup Towns Protocol</h1>
          <p className="font-georgia-pro text-lg mb-6 text-gray-600">
            Connect your wallet to create the Knead Chat space
          </p>
          <p className="font-georgia-pro text-sm mb-8 text-gray-500">
            This is a one-time setup. The space will be created on Base mainnet.
          </p>
          <ThirdWebConnectButton />
        </div>
      </div>
    );
  }

  // Connecting to Towns
  if (!syncAgent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-2xl w-full bg-gray-50 rounded-lg p-8 text-center">
          <h1 className="font-adonis text-3xl mb-4">Connecting to Towns Protocol...</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-600 mb-2">
            {isConnecting ? 'Please sign the message in your wallet' : 'Initializing connection...'}
          </p>
          <p className="font-georgia-pro text-sm text-gray-500">
            Connected: {account.address.slice(0, 6)}...{account.address.slice(-4)}
          </p>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
              {error}
              <button
                onClick={() => window.location.reload()}
                className="block mx-auto mt-2 px-4 py-2 bg-red-600 text-white rounded text-xs hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Success - show IDs
  if (spaceCreated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-3xl w-full bg-gray-50 rounded-lg p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="font-adonis text-4xl mb-2">Space Created!</h1>
            <p className="font-georgia-pro text-gray-600">
              Your Knead Chat space is live on Towns Protocol
            </p>
          </div>
          
          <div className="mb-6 p-6 bg-white rounded-lg border-2 border-green-200">
            <h2 className="font-adonis text-2xl mb-4">Copy These to Vercel Environment Variables:</h2>
            
            <div className="mb-4">
              <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-2">
                Space ID:
              </label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all border border-gray-300">
                {spaceCreated.spaceId}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(spaceCreated.spaceId);
                  alert('Space ID copied!');
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                📋 Copy Space ID
              </button>
            </div>
            
            <div className="mb-4">
              <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-2">
                Default Channel ID:
              </label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all border border-gray-300">
                {spaceCreated.channelId}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(spaceCreated.channelId);
                  alert('Channel ID copied!');
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                📋 Copy Channel ID
              </button>
            </div>

            <div className="mt-6 p-4 bg-gray-900 text-green-400 rounded font-mono text-xs overflow-x-auto">
              <div className="mb-1">NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={spaceCreated.spaceId}</div>
              <div>NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={spaceCreated.channelId}</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-georgia-pro font-semibold mb-2">📝 Next Steps:</h3>
            <ol className="font-georgia-pro text-sm space-y-2 list-decimal list-inside">
              <li>Go to your Vercel project settings</li>
              <li>Add these two environment variables</li>
              <li>Redeploy your application</li>
              <li>Test your chat at <code className="bg-blue-100 px-1 rounded">/chat-test</code></li>
            </ol>
          </div>

          <div className="text-center space-x-4">
            <a
              href="/chat-test"
              className="inline-block px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
            >
              Go to Chat Test →
            </a>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-white border-2 border-black text-black rounded-full font-georgia-pro hover:bg-gray-50 transition"
            >
              Open Vercel Dashboard ↗
            </a>
          </div>

          <p className="text-center font-georgia-pro text-xs text-gray-500 mt-6">
            ⚠️ This page can be deleted after copying the IDs to Vercel
          </p>
        </div>
      </div>
    );
  }

  // Connected - ready to create (wrap form in TownsSyncProvider with syncAgent)
  return (
    <TownsSyncProvider syncAgent={syncAgent}>
      <CreateSpaceForm 
        onSpaceCreated={(spaceId, channelId) => setSpaceCreated({ spaceId, channelId })} 
      />
    </TownsSyncProvider>
  );
}
