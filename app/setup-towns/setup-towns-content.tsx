'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useCreateSpace } from '@towns-protocol/react-sdk';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { ethers } from 'ethers';

export default function SetupTownsContent() {
  const account = useActiveAccount();
  const { createSpace, isPending } = useCreateSpace();
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateSpace = async () => {
    if (!account) {
      setError('Please connect wallet first');
      return;
    }

    try {
      console.log('🔐 Connected wallet:', account.address);
      setError(null);

      // Get signer from window.ethereum
      if (!window.ethereum) {
        throw new Error('No ethereum provider found');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      console.log('📝 Creating space via Towns SDK...');
      
      const res = await createSpace(
        { spaceName: 'Knead Chat' },
        signer
      );

      console.log('✅ Space created:', res);
      setResult(res);

    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err.message || 'Failed to create space');
    }
  };

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-3xl w-full bg-gray-50 rounded-lg p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-4xl font-bold mb-2">Space Created!</h1>
            <p className="text-gray-600">
              Your Knead Chat space is live on Towns Protocol
            </p>
          </div>

          <div className="mb-6 p-6 bg-white rounded-lg border-2 border-green-200">
            <h2 className="text-2xl font-bold mb-4">Copy These to Vercel:</h2>

            <div className="mb-4">
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Space ID:
              </label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all border border-gray-300">
                {result.spaceId || result.space || 'Check console for spaceId'}
              </div>
              <button
                onClick={() => {
                  const id = result.spaceId || result.space;
                  if (id) {
                    navigator.clipboard.writeText(id);
                    alert('Space ID copied!');
                  }
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
                {result.defaultChannelId || result.channelId || 'Same as Space ID'}
              </div>
              <button
                onClick={() => {
                  const id = result.defaultChannelId || result.channelId || result.spaceId || result.space;
                  if (id) {
                    navigator.clipboard.writeText(id);
                    alert('Channel ID copied!');
                  }
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                📋 Copy Channel ID
              </button>
            </div>

            <div className="mt-6 p-4 bg-gray-900 text-green-400 rounded font-mono text-xs overflow-x-auto">
              <div className="mb-1">NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={result.spaceId || result.space || 'CHECK_CONSOLE'}</div>
              <div>NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={result.defaultChannelId || result.channelId || result.spaceId || result.space || 'CHECK_CONSOLE'}</div>
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
              <li>Wait for automatic redeploy</li>
              <li>Start building your tokenomics system!</li>
            </ol>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2">🐛 Debug Info:</h3>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(result, null, 2)}
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
            Creates your Towns Protocol Space where your gamified chat will live. This is a one-time setup.
          </p>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>Connect your wallet (you'll own the Space NFT)</li>
            <li>Click Create Space</li>
            <li>Sign the transaction (Towns SDK handles the complexity)</li>
            <li>Get your Space ID and Channel ID</li>
            <li>Add to Vercel environment variables</li>
            <li>Start building your tokenomics!</li>
          </ol>
        </div>

        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-semibold mb-2">🔧 What Happens Behind the Scenes:</h3>
          <ul className="text-sm space-y-1">
            <li>• Towns SDK creates a smart contract wallet for you</li>
            <li>• Deploys a Space contract on Base</li>
            <li>• Mints a Space NFT to your wallet</li>
            <li>• Sets up default channel</li>
            <li>• You retain full ownership</li>
          </ul>
        </div>

        {!account ? (
          <div className="text-center">
            <p className="mb-4 text-gray-600">
              Connect your wallet to get started:
            </p>
            <ThirdWebConnectButton />
          </div>
        ) : (
          <div>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ <strong>Wallet Connected:</strong> {account.address.slice(0, 6)}...{account.address.slice(-4)}
              </p>
              <p className="text-xs text-green-700 mt-2">
                You'll need to sign a message to create your Space. This might take a moment.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                ❌ {error}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs">Show debug info</summary>
                  <pre className="text-xs mt-2 overflow-x-auto">
                    {error}
                  </pre>
                </details>
              </div>
            )}

            <button
              onClick={handleCreateSpace}
              disabled={isPending}
              className="w-full px-8 py-4 bg-black text-white rounded-full text-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? '⏳ Creating Space (this may take a minute)...' : '🚀 Create Knead Chat Space'}
            </button>

            <p className="text-xs text-gray-500 mt-4 text-center">
              Using Towns Protocol SDK - you'll sign with your connected wallet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
