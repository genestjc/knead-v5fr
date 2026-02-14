'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useCreateChannel, useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { ethers } from 'ethers';

export default function ChannelManagerContent() {
  const account = useActiveAccount();
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; channelId?: string; error?: string } | null>(null);
  const [isConnectingTowns, setIsConnectingTowns] = useState(false);

  const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
  const townsConfig = townsEnv().makeTownsConfig('omega');
  const { connect, isAgentConnected } = useAgentConnection();
  const { createChannel } = useCreateChannel(spaceId);

  // Auto-connect to Towns
  useEffect(() => {
    const connectToTowns = async () => {
      if (account && !isAgentConnected && !isConnectingTowns && typeof window !== 'undefined' && window.ethereum) {
        setIsConnectingTowns(true);
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          await connect(signer, { townsConfig });
          console.log('✅ Connected to Towns Protocol');
        } catch (err) {
          console.error('Failed to connect to Towns:', err);
        } finally {
          setIsConnectingTowns(false);
        }
      }
    };

    connectToTowns();
  }, [account, isAgentConnected, isConnectingTowns, connect, townsConfig]);

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
      console.log('🏗️ Creating channel with MetaMask...');
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const channelId = await createChannel(
        channelName,
        signer,
        { topic: channelDescription || '' }
      );

      console.log(`✅ Created ${channelName}: ${channelId}`);

      setResult({ success: true, channelId });
      setChannelName('');
      setChannelDescription('');
    } catch (error) {
      console.error('Error creating channel:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
                <span className="font-georgia-pro text-yellow-800">Connecting...</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-adonis text-lg mb-2">ℹ️ How This Works</h3>
        <ol className="font-georgia-pro text-sm space-y-1 list-decimal list-inside text-gray-700">
          <li>Fill in the channel details below</li>
          <li>Click &quot;Create Channel&quot;</li>
          <li>Approve the transaction in MetaMask</li>
          <li>Copy the channel ID and add it to your code/env vars</li>
          <li>Redeploy to use the new channel</li>
        </ol>
      </div>

      {/* Create Channel Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-adonis text-xl mb-4">Create New Channel</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block font-georgia-pro text-sm font-medium mb-2">
              Channel Name
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="e.g., knead-participants-c"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              disabled={isCreating}
            />
          </div>

          <div>
            <label className="block font-georgia-pro text-sm font-medium mb-2">
              Description
            </label>
            <input
              type="text"
              value={channelDescription}
              onChange={(e) => setChannelDescription(e.target.value)}
              placeholder="e.g., Participant messages (shard C: addresses starting with 8-9)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-georgia-pro text-sm"
              disabled={isCreating}
            />
          </div>

          <button
            onClick={handleCreateChannel}
            disabled={isCreating || !isAgentConnected || !account || !channelName.trim()}
            className="w-full bg-black text-white font-georgia-pro py-3 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {isCreating ? '⏳ Creating... (Check MetaMask)' : '🏗️ Create Channel with MetaMask'}
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
                  onClick={() => navigator.clipboard.writeText(result.channelId!)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="font-georgia-pro text-sm text-yellow-800">
                  💡 Add this channel ID to your code or environment variables, then redeploy to use it!
                </p>
              </div>
            </div>
          )}
          
          {result.error && (
            <div>
              <p className="font-georgia-pro text-sm text-red-800">{result.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Security Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-adonis text-lg mb-2 text-blue-800">🔐 Secure & Simple</h3>
        <p className="font-georgia-pro text-sm text-blue-800">
          Your private key never leaves MetaMask. You sign each transaction directly in your wallet.
          This is the old-school Web3 way - your keys, your control! 🗝️
        </p>
      </div>
    </div>
  );
}
