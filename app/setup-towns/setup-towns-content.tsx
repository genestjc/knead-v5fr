'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { ethers } from 'ethers';
import { useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';

export default function SetupTownsContent() {
  const account = useActiveAccount();
  const { connect, isAgentConnecting, isAgentConnected } = useAgentConnection();
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

      // Get Towns config for production
      const townsConfig = townsEnv().makeTownsConfig('omega'); // 'omega' = production
      console.log('Config:', townsConfig);

      // Connect using the hook's connect method
      const agent = await connect(signer, { townsConfig });
      
      if (!agent) {
        throw new Error('Failed to create agent');
      }

      console.log('✅ Agent connected:', agent);

      console.log('🏗️ Creating space...');

      // Create space via agent
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
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        code: err.code,
        reason: err.reason
      });
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
            <p className="text-gray-600">Your Knead Chat space is live on Towns Protocol</p>
          </div>

          <div className="mb-6 p-6 bg-white rounded-lg border-2 border-green-200">
            <h2 className="text-2xl font-bold mb-4">Copy These to Vercel:</h2>

            <div className="mb-4">
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Space ID:
              </label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all border border-gray-300">
                {result.spaceId}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result.spaceId);
                  alert('Space ID copied!');
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                📋 Copy Space ID
              </button>
            </div>

            <div className="mb-4">
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Default Channel ID:
              </label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all border border-gray-300">
                {result.defaultChannelId}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result.defaultChannelId);
                  alert('Channel ID copied!');
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                📋 Copy Channel ID
              </button>
            </div>

            <div className="mt-6 p-4 bg-gray-900 text-green-400 rounded font-mono text-xs overflow-x-auto">
              <div className="mb-1">NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={result.spaceId}</div>
              <div>NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={result.defaultChannelId}</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2">📝 Next Steps:</h3>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Copy both environment variables above</li>
              <li>
                Go to{' '}
                <a
                  href="https://vercel.com/genestjcs-projects/knead-v5fr/settings/environment-variables"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Vercel Settings ↗
                </a>
              </li>
              <li>Add both variables and save</li>
              <li>Uncomment TownsSyncProvider in app/providers.tsx</li>
              <li>Wait for automatic redeploy</li>
              <li>Start building your tokenomics!</li>
            </ol>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2">🐛 Debug Info:</h3>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(result.fullResult, null, 2)}
            </pre>
          </div>

          <div className="text-center">
            <a
              href="https://vercel.com/genestjcs-projects/knead-v5fr/settings/environment-variables"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition"
            >
              Open Vercel Settings →
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
          <h2 className="text-xl font-bold mb-3">What This Does:</h2>
          <p className="text-sm mb-4">
            Creates your Towns Protocol Space using useAgentConnection hook.
          </p>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>Connect your wallet</li>
            <li>Connect to Towns Protocol SyncAgent</li>
            <li>Create space via agent.spaces.createSpace()</li>
            <li>Get Space ID and Channel ID</li>
            <li>Add to Vercel environment variables</li>
          </ol>
        </div>

        {!account ? (
          <div className="text-center">
            <p className="mb-4 text-gray-600">Connect your wallet to get started:</p>
            <ThirdWebConnectButton />
          </div>
        ) : (
          <div>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ <strong>Wallet Connected:</strong> {account.address.slice(0, 6)}...{account.address.slice(-4)}
              </p>
              {isAgentConnected && (
                <p className="text-xs text-green-700 mt-2">
                  ✅ Towns Agent Connected
                </p>
              )}
              {isAgentConnecting && (
                <p className="text-xs text-blue-700 mt-2">
                  ⏳ Connecting to Towns...
                </p>
              )}
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                ❌ {error}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs">Show debug info</summary>
                  <pre className="text-xs mt-2 overflow-x-auto">{error}</pre>
                </details>
              </div>
            )}

            <button
              onClick={handleCreateSpace}
              disabled={isCreating || isAgentConnecting}
              className="w-full px-8 py-4 bg-black text-white rounded-full text-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAgentConnecting
                ? '⏳ Connecting to Towns...'
                : isCreating
                ? '⏳ Creating Space...'
                : '🚀 Create Knead Chat Space'}
            </button>

            <p className="text-xs text-gray-500 mt-4 text-center">
              Using useAgentConnection hook from @towns-protocol/react-sdk
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
