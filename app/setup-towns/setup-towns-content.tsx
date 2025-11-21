'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { ethers } from 'ethers';
// Import from SDK, not react-sdk
import { signAndConnect, townsEnv } from '@towns-protocol/sdk';

export default function SetupTownsContent() {
  const account = useActiveAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleCreateSpace = async () => {
    if (!account) {
      setError('Please connect wallet first');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      console.log('🔐 Connected wallet:', account.address);

      // Get signer
      if (!window.ethereum) {
        throw new Error('No ethereum provider found');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      console.log('📝 Connecting to Towns Protocol...');

      // Use townsEnv to get config
      const townsConfig = townsEnv().makeTownsConfig('omega'); // 'omega' is production

      console.log('Config:', townsConfig);

      // Connect
      const agent = await signAndConnect(signer, { townsConfig });
      console.log('✅ Connected, agent:', agent);

      console.log('🏗️ Creating space...');

      // Create space
      const spaceResult = await agent.spaces.createSpace({
        spaceName: 'Knead Chat'
      }, signer);

      console.log('✅ Space created!', spaceResult);

      setResult({
        spaceId: spaceResult.spaceId,
        defaultChannelId: spaceResult.defaultChannelId,
        fullResult: spaceResult
      });

    } catch (err: any) {
      console.error('❌ Error:', err);
      console.error('Error stack:', err.stack);
      setError(err.message || 'Failed to create space');
    } finally {
      setIsCreating(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-3xl w-full bg-gray-50 rounded-lg p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-4xl font-bold mb-2">Space Created!</h1>
            <p className="text-gray-600">Your Knead Chat space is live</p>
          </div>

          <div className="mb-6 p-6 bg-white rounded-lg border-2 border-green-200">
            <h2 className="text-2xl font-bold mb-4">Environment Variables:</h2>

            <div className="mb-4">
              <label className="text-sm font-semibold block mb-2">Space ID:</label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all">
                {result.spaceId}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result.spaceId);
                  alert('Copied!');
                }}
                className="mt-2 text-sm text-blue-600"
              >
                📋 Copy
              </button>
            </div>

            <div className="mb-4">
              <label className="text-sm font-semibold block mb-2">Channel ID:</label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all">
                {result.defaultChannelId}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result.defaultChannelId);
                  alert('Copied!');
                }}
                className="mt-2 text-sm text-blue-600"
              >
                📋 Copy
              </button>
            </div>

            <div className="mt-6 p-4 bg-gray-900 text-green-400 rounded font-mono text-xs overflow-x-auto">
              <div>NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={result.spaceId}</div>
              <div>NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={result.defaultChannelId}</div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
            <h3 className="font-semibold mb-2">Debug:</h3>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(result.fullResult, null, 2)}
            </pre>
          </div>

          <div className="text-center">
            <a
              href="https://vercel.com/genestjcs-projects/knead-v5fr/settings/environment-variables"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-black text-white rounded-full"
            >
              Add to Vercel →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-2xl w-full bg-gray-50 rounded-lg p-8">
        <h1 className="text-4xl font-bold mb-4 text-center">Create Knead Chat Space</h1>

        <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <h2 className="text-xl font-bold mb-3">Setup:</h2>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>Connect wallet</li>
            <li>Click create space</li>
            <li>Sign messages</li>
            <li>Get Space ID</li>
            <li>Add to Vercel</li>
          </ol>
        </div>

        {!account ? (
          <div className="text-center">
            <p className="mb-4">Connect your wallet:</p>
            <ThirdWebConnectButton />
          </div>
        ) : (
          <div>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-sm">
                ✅ Connected: {account.address.slice(0, 6)}...{account.address.slice(-4)}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 rounded text-red-600 text-sm">
                ❌ {error}
              </div>
            )}

            <button
              onClick={handleCreateSpace}
              disabled={isCreating}
              className="w-full px-8 py-4 bg-black text-white rounded-full text-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {isCreating ? '⏳ Creating...' : '🚀 Create Space'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
