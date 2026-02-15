'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useCreateChannel, useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { ethers } from 'ethers';

// ✅ Hoist config outside component to prevent recreation
const townsConfig = townsEnv().makeTownsConfig('omega');

export default function ChannelManagerContent() {
  const account = useActiveAccount();
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; channelId?: string; error?: string } | null>(null);

  const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
  const { connect, isAgentConnected, syncAgent } = useAgentConnection();
  const { createChannel, isPending, error: createError } = useCreateChannel(spaceId);

  // Auto-connect to Towns
  useEffect(() => {
    const connectToTowns = async () => {
      if (account && !isAgentConnected && !syncAgent && typeof window !== 'undefined' && window.ethereum) {
        try {
          console.log('🔌 Connecting to Towns Protocol...');
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          
          // ✅ Await the connection
          await connect(signer, { townsConfig });
          
          console.log('✅ Connected to Towns Protocol');
        } catch (err) {
          console.error('❌ Failed to connect to Towns:', err);
        }
      }
    };

    connectToTowns();
  }, [account, isAgentConnected, syncAgent, connect]);

  const handleCreateChannel = async () => {
    if (!channelName.trim()) {
      alert('Please enter a channel name');
      return;
    }

    if (!account || !isAgentConnected) {
      alert('Please connect wallet and wait for Towns connection');
      return;
    }

    if (typeof window === 'undefined' || !window.ethereum) {
      alert('MetaMask not detected');
      return;
    }

    setIsCreating(true);
    setResult(null);

    try {
      console.log('🏗️ Creating channel:', channelName);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const channelId = await createChannel(
        channelName,
        signer,
        channelDescription ? { topic: channelDescription } : undefined
      );

      console.log('✅ Channel created successfully!');
      console.log('   Channel ID:', channelId);

      setResult({ success: true, channelId });
      setChannelName('');
      setChannelDescription('');
    } catch (error: any) {
      console.error('❌ Error creating channel:', error);
      setResult({
        success: false,
        error: error?.message || 'Unknown error',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-adonis text-2xl mb-2">Channel Management</h2>
        <p className="font-georgia-pro text-gray-600">
          Create new channels for sharding or organizing conversations
        </p>
      </div>

      {/* Connection Status */}
      {account && (
        <div className={`border rounded-lg p-3 ${
          isAgentConnected 
            ? 'bg-green-50 border-green-300' 
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-center gap-2 text-sm">
            {isAgentConnected ? (
              <>
                <span className="text-green-600">✅</span>
                <span className="font-georgia-pro text-green-800">Towns Connected</span>
              </>
            ) : (
              <>
                <span className="animate-spin text-yellow-600">⏳</span>
                <span className="font-georgia-pro text-yellow-800">Connecting to Towns...</span>
              </>
            )}
          </div>
        </div>
      )}

      {!account && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <p className="font-georgia-pro text-yellow-800">
            ⚠️ Please connect your wallet to use the channel manager
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-adonis text-lg mb-2">ℹ️ How This Works</h3>
        <ol className="font-georgia-pro text-sm space-y-1 list-decimal list-inside text-gray-700">
          <li>Connect your wallet (must be space owner)</li>
          <li>Wait for Towns connection</li>
          <li>Fill in the channel details below</li>
          <li>Click &quot;Create Channel&quot;</li>
          <li>Approve the transaction in MetaMask</li>
          <li>Copy the channel ID and add it to env vars</li>
          <li>Redeploy to use the new channel</li>
        </ol>
      </div>

      {/* Create Channel Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-adonis text-xl mb-4">Create New Channel</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block font-georgia-pro text-sm font-medium mb-2">
              Channel Name *
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="e.g., knead-contributors"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isCreating || !isAgentConnected}
            />
          </div>

          <div>
            <label className="block font-georgia-pro text-sm font-medium mb-2">
              Description (optional)
            </label>
            <input
              type="text"
              value={channelDescription}
              onChange={(e) => setChannelDescription(e.target.value)}
              placeholder="e.g., Messages from contributors"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-georgia-pro text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isCreating || !isAgentConnected}
            />
          </div>

          <button
            onClick={handleCreateChannel}
            disabled={isCreating || !isAgentConnected || !account || !channelName.trim()}
            className="w-full bg-black text-white font-georgia-pro py-3 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {isCreating || isPending 
              ? '⏳ Creating... (Check MetaMask)' 
              : '🏗️ Create Channel with MetaMask'}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className={`border rounded-lg p-6 ${
          result.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <h3 className={`font-adonis text-xl mb-2 ${
            result.success ? 'text-green-600' : 'text-red-600'
          }`}>
            {result.success ? '✅ Channel Created!' : '❌ Error'}
          </h3>
          
          {result.success && result.channelId && (
            <div className="space-y-2">
              <p className="font-georgia-pro text-sm text-gray-700">
                Channel ID:
              </p>
              <div className="flex items-center gap-2 bg-white p-3 rounded border border-gray-300">
                <code className="font-mono text-sm flex-1 break-all">
                  {result.channelId}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result.channelId!);
                    alert('✅ Copied to clipboard!');
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
              </div>
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="font-georgia-pro text-sm text-yellow-800">
                  💡 Add this to Vercel env vars, then redeploy!
                </p>
              </div>
            </div>
          )}
          
          {result.error && (
            <div className="bg-white rounded p-3 mt-2">
              <p className="font-georgia-pro text-sm text-red-800">
                <strong>Error details:</strong><br/>
                {result.error}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-xs">
          <p>Debug Info:</p>
          <p>Account: {account?.address?.slice(0, 10)}...</p>
          <p>Towns Connected: {isAgentConnected ? 'Yes' : 'No'}</p>
          <p>Space ID: {spaceId?.slice(0, 20)}...</p>
          <p>Create Pending: {isPending ? 'Yes' : 'No'}</p>
          {createError && <p className="text-red-600">SDK Error: {createError.message}</p>}
        </div>
      )}
    </div>
  );
}
