'use client';

import { useState } from 'react';
import { useActiveAccount, useThirdwebClient } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { townsEnv } from '@towns-protocol/sdk';
import { signAndConnect } from '@towns-protocol/react-sdk';
import type { SyncAgent } from '@towns-protocol/sdk';
import { ethers5Adapter } from 'thirdweb/adapters/ethers5';

export default function SetupTownsContent() {
  const account = useActiveAccount();
  const client = useThirdwebClient(); // Get the ThirdWeb client
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [agent, setAgent] = useState<SyncAgent | null>(null);

  const handleConnectAndCreateSpace = async () => {
    // Ensure client, account, and chain are available
    if (!client || !account || !account.chain) {
      setError('Wallet not fully connected. Please try connecting again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log('🚀 Starting setup process...');

      // Correctly convert the ThirdWeb account to an ethers.js v5 signer
      const signer = await ethers5Adapter.signer.toEthers({
        client,
        chain: account.chain,
        account,
      });

      console.log('✅ Created ethers v5 compatible signer for:', await signer.getAddress());
      
      console.log('🔐 Step 1: Connecting to Towns Protocol...');
      const townsConfig = townsEnv().makeTownsConfig('omega');
      
      const connectedAgent = await signAndConnect(signer, { townsConfig });
      setAgent(connectedAgent);

      console.log('✅ Agent connected!');
      console.log('🏗️ Step 2: Creating space with agent...');
      
      // Pass the same ethers v5 signer to the createSpace method
      const spaceResult = await connectedAgent.spaces.createSpace({
        spaceName: 'Knead Chat'
      }, signer);

      console.log('✅ Space created!', spaceResult);

      setResult({
        spaceId: spaceResult.spaceId,
        defaultChannelId: spaceResult.defaultChannelId,
        fullResult: spaceResult
      });

    } catch (err: any) {
      console.error('❌ Error during setup:', err);
      setError(err.message || 'An unexpected error occurred during setup.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Success screen
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
          <h2 className="text-xl font-bold mb-3">One-Step Setup:</h2>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li><strong>Connect Wallet:</strong> First, connect your wallet.</li>
            <li><strong>Create Space:</strong> Then, click the button to sign and create your Knead Chat space.</li>
          </ol>
           <p className="text-xs text-gray-500 mt-3">This process involves two signatures: one to authenticate with Towns and one to deploy your space contract.</p>
        </div>
        
        {/* Step 1: Connect Wallet */}
        {!account ? (
          <div className="text-center">
            <p className="mb-4 text-gray-600">First, connect your wallet:</p>
            <ThirdWebConnectButton />
          </div>
        ) : (
          // Step 2: Connect to Towns & Create Space
          <div>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ <strong>Wallet Connected!</strong>
              </p>
              <p className="text-xs text-gray-600 mt-2">
                You are ready to create your Knead Chat space.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                ❌ {error}
              </div>
            )}

            <button
              onClick={handleConnectAndCreateSpace}
              disabled={isProcessing}
              className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full text-lg hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? '⏳ Creating Space...' : '🚀 Create Knead Chat Space'}
            </button>
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              This will deploy your space contract on the Base network.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
