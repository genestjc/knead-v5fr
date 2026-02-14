'use client';

import { useState } from 'react';
import { useActiveAccount, useSigner } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { townsEnv } from '@towns-protocol/sdk';
import { connectTowns } from '@towns-protocol/react-sdk';
import { ethers } from 'ethers';
import { base } from 'thirdweb/chains';

interface ChannelManagerProps {
  adminAddress: string;
}

let cachedClient: ReturnType<typeof createThirdwebClient> | null = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
    });
  }
  return cachedClient;
}

export function ChannelManager({ adminAddress }: ChannelManagerProps) {
  const account = useActiveAccount();
  const signer = useSigner({ client: getClient(), chain: base });
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; channelId?: string; error?: string } | null>(null);

  const handleCreateChannel = async () => {
    if (!channelName.trim()) {
      alert('Please enter a channel name');
      return;
    }

    if (!account || !signer) {
      alert('Please connect your wallet');
      return;
    }

    setIsCreating(true);
    setResult(null);

    try {
      console.log('🏗️ Creating channel with MetaMask...');

      // Convert to ethers signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const ethersSigner = provider.getSigner();

      // Connect to Towns
      const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
      const townsConfig = townsEnv().makeTownsConfig('omega', {
        rpcUrl: BASE_RPC_URL,
      });
      
      const agent = await connectTowns(ethersSigner, { 
        townsConfig,
      });

      // Join space
      const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
      const space = await agent.spaces.getSpace(spaceId);
      
      // Check if already a member
      const isMember = await space.isMember(account.address);
      if (!isMember) {
        console.log('Joining space...');
        await space.joinSpace(ethersSigner);
      }

      // Create the channel (MetaMask will prompt)
      const channelId = await space.createChannel(
        channelName,
        channelDescription || '',
        ethersSigner
      );

      console.log(`✅ Created ${channelName}: ${channelId}`);

      // Disconnect
      agent.stop();

      setResult({
        success: true,
        channelId,
      });

      // Clear form on success
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

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-adonis text-lg mb-2">ℹ️ How This Works</h3>
        <ol className="font-georgia-pro text-sm space-y-1 list-decimal list-inside text-gray-700">
          <li>Fill in the channel details below</li>
          <li>Click "Create Channel"</li>
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
            disabled={isCreating || !channelName.trim()}
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
