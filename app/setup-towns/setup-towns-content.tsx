'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';

export default function SetupTownsContent() {
  const [mounted, setMounted] = useState(false);
  const [spaceCreated, setSpaceCreated] = useState<{ spaceId: string; channelId: string; transactionHash: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const account = useActiveAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateSpace = async () => {
    setIsCreating(true);
    setError(null);
    
    try {
      console.log('🚀 Creating Knead Chat space via server API...');
      
      const response = await fetch('/api/towns/create-space', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Knead Chat' })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create space');
      }

      console.log('✅ Space created successfully!');
      console.log('📋 Space ID:', data.spaceId);
      console.log('📋 Default Channel ID:', data.defaultChannelId);
      console.log('🔗 Transaction:', data.explorerUrl);

      setSpaceCreated({
        spaceId: data.spaceId,
        channelId: data.defaultChannelId,
        transactionHash: data.transactionHash
      });

    } catch (err: any) {
      console.error('❌ Error creating space:', err);
      setError(err.message || 'Failed to create space');
    } finally {
      setIsCreating(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

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

            <div className="mb-4">
              <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-2">
                Transaction Hash:
              </label>
              <a 
                href={`https://basescan.org/tx/${spaceCreated.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                View on BaseScan ↗
              </a>
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-2xl w-full bg-gray-50 rounded-lg p-8 text-center">
        <h1 className="font-adonis text-4xl mb-4">Create Knead Chat Space</h1>
        <p className="font-georgia-pro text-lg mb-4 text-gray-600">
          Click below to create your Towns Protocol space for Knead Chat.
        </p>
        <p className="font-georgia-pro text-sm mb-8 text-gray-500">
          This will be created using your server wallet on Base mainnet. No wallet connection needed!
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
        
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
          <p className="font-georgia-pro text-sm text-blue-800">
            <strong>ℹ️ Server-Side Creation:</strong> This uses ThirdWeb to call the SpaceFactory contract directly, 
            avoiding browser storage issues. The space will be owned by your server wallet.
          </p>
        </div>
      </div>
    </div>
  );
}
