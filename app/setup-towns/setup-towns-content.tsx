'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { townsEnv } from '@towns-protocol/sdk';
import { useAgentConnection, useSyncAgent } from '@towns-protocol/react-sdk';
// This now imports specifically from the aliased ethers v5 package
import { ethers } from 'ethers-v5'; 

export default function SetupTownsContent() {
  const account = useActiveAccount();
  const { connect, isAgentConnecting, isAgentConnected } = useAgentConnection();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Get agent from context - only available after isAgentConnected = true
  let agent = null;
  try {
    if (isAgentConnected) {
      agent = useSyncAgent();
    }
  } catch (e) {
    console.log('Agent not available yet');
  }

  // Debug logging
  useEffect(() => {
    console.log('🔍 State Update:', {
      hasAccount: !!account,
      isAgentConnecting,
      isAgentConnected,
      hasAgent: !!agent,
    });
  }, [account, isAgentConnecting, isAgentConnected, agent]);

  // Helper to create the required ethers v5 signer
  const getEthers5Signer = () => {
    if (!(window as any).ethereum) {
      throw new Error('No wallet provider found. Please ensure your browser wallet is active.');
    }
    const providerV5 = new ethers.providers.Web3Provider((window as any).ethereum);
    return providerV5.getSigner();
  };

  // Step 1: Connect to Towns Protocol
  const handleConnect = async () => {
    if (!account) {
      setError('Please connect wallet first');
      return;
    }
    setError(null);

    try {
      console.log('🔐 Step 1: Connecting to Towns Protocol...');
      const signerV5 = getEthers5Signer();
      console.log('✅ Created ethers v5 signer for connection');

      const townsConfig = townsEnv().makeTownsConfig('omega');
      await connect(signerV5, { townsConfig });
      
      console.log('✅ Connection initiated - waiting for state update from hook...');
    } catch (err: any) {
      console.error('❌ Error connecting:', err);
      setError(err.message || 'Failed to connect to Towns');
    }
  };

  // Step 2: Create space (only callable after agent is ready)
  const handleCreateSpace = async () => {
    if (!isAgentConnected || !agent) {
      setError('Agent not ready. Please wait for connection to complete.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      console.log('🏗️ Step 2: Creating space with agent...');
      const signerV5 = getEthers5Signer();
      console.log('✅ Created ethers v5 signer for space creation');

      const spaceResult = await agent.spaces.createSpace({
        spaceName: 'Knead Chat'
      }, signerV5);

      console.log('✅ Space created!', spaceResult);
      setResult(spaceResult);
    } catch (err: any) {
      console.error('❌ Error creating space:', err);
      setError(err.message || 'Failed to create space');
    } finally {
      setIsCreating(false);
    }
  };

  // --- The rest of the component (UI) is the same as your original file ---
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

            <button
              onClick={() => {
                const envVars = `NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=${result.spaceId}\nNEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=${result.defaultChannelId}`;
                navigator.clipboard.writeText(envVars);
                alert('Both env vars copied to clipboard!');
              }}
              className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              📋 Copy Both Environment Variables
            </button>
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
              <li>Paste and save both variables</li>
              <li>Uncomment TownsSyncProvider in app/providers.tsx</li>
              <li>Push to GitHub (auto-redeploy)</li>
              <li>Start building your tokenomics! 🎮</li>
            </ol>
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

  // Main form
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-2xl w-full bg-gray-50 rounded-lg p-8">
        <h1 className="text-4xl font-bold mb-4 text-center">Create Knead Chat Space</h1>

        <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <h2 className="text-xl font-bold mb-3">Two-Step Setup:</h2>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li><strong>Step 1:</strong> Connect to Towns Protocol (sign message)</li>
            <li><strong>Step 2:</strong> Create your Knead Chat space (sign transaction)</li>
          </ol>
        </div>

        {/* Debug Panel */}
        <div className="mb-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
          <h3 className="font-semibold mb-2 text-xs text-gray-600">Debug Status:</h3>
          <div className="text-xs space-y-1 font-mono text-gray-700">
            <div>✓ Wallet: {account ? `Connected (${account.address.slice(0, 6)}...${account.address.slice(-4)})` : 'Not connected'}</div>
            <div>✓ isAgentConnecting: {isAgentConnecting ? 'true ⏳' : 'false'}</div>
            <div>✓ isAgentConnected: {isAgentConnected ? 'true ✅' : 'false ❌'}</div>
            <div>✓ Agent Available: {agent ? 'Yes ✅' : 'No ❌'}</div>
          </div>
        </div>

        {/* Step 1: Connect Wallet */}
        {!account ? (
          <div className="text-center">
            <p className="mb-4 text-gray-600">First, connect your wallet:</p>
            <ThirdWebConnectButton />
          </div>
        ) : !isAgentConnected ? (
          // Step 2: Connect to Towns
          <div>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ <strong>Wallet Connected</strong>
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Now connect to Towns Protocol
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                ❌ {error}
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={isAgentConnecting}
              className="w-full px-8 py-4 bg-black text-white rounded-full text-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAgentConnecting ? '⏳ Connecting to Towns...' : '🔗 Step 1: Connect to Towns Protocol'}
            </button>

            <p className="text-xs text-gray-500 mt-4 text-center">
              You'll sign a message to authenticate
            </p>
          </div>
        ) : (
          // Step 3: Create Space
          <div>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ <strong>Towns Protocol Connected!</strong>
              </p>
              <p className="text-xs text-green-700 mt-2">
                Ready to create your space
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                ❌ {error}
              </div>
            )}

            <button
              onClick={handleCreateSpace}
              disabled={isCreating || !agent}
              className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full text-lg hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? '⏳ Creating Space...' : '🚀 Step 2: Create Knead Chat Space'}
            </button>

            {!agent && (
              <p className="text-xs text-orange-600 mt-4 text-center">
                ⏳ Agent initializing... (refresh if this takes more than 5 seconds)
              </p>
            )}

            <p className="text-xs text-gray-500 mt-4 text-center">
              This will deploy your space contract on Base network
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
