'use client';

import { useState } from 'react';
import { useActiveAccount, ConnectButton } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { townsEnv } from '@towns-protocol/sdk';
import { connectTowns } from '@towns-protocol/react-sdk';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

let cachedClient: ReturnType<typeof createThirdwebClient> | null = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
    });
  }
  return cachedClient;
}

interface ChannelIds {
  contributors: string;
  participantsA: string;
  participantsB: string;
  files: string;
}

const CHANNEL_DEFINITIONS = [
  {
    name: 'knead-contributors',
    description: 'All contributor messages (text only)',
    key: 'contributors',
  },
  {
    name: 'knead-participants-a',
    description: 'Participant messages during events (shard A: address 0-7)',
    key: 'participantsA',
  },
  {
    name: 'knead-participants-b',
    description: 'Participant messages during events (shard B: address 8-f)',
    key: 'participantsB',
  },
  {
    name: 'knead-files',
    description: 'All file uploads and IPFS content',
    key: 'files',
  },
];

export default function AdminSetupPage() {
  const account = useActiveAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelIds, setChannelIds] = useState<ChannelIds | null>(null);
  
  const client = getClient();
  const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET || '';

  const handleCreateChannels = async () => {
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask not detected. Please install MetaMask.');
      return;
    }

    setIsCreating(true);
    setError(null);
    setChannelIds(null);

    try {
      console.log('🏗️ Creating channels with MetaMask...');
      
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
      
      // Check if already a member, if not join
      const isMember = await space.isMember(account.address);
      if (!isMember) {
        console.log('Joining space...');
        await space.joinSpace(ethersSigner);
      }

      // Create all 4 channels
      const channels: Record<string, string> = {};

      for (const def of CHANNEL_DEFINITIONS) {
        console.log(`Creating channel: ${def.name}`);
        
        // MetaMask will prompt for signature
        const channelId = await space.createChannel(
          def.name,
          def.description,
          ethersSigner
        );
        
        channels[def.key] = channelId;
        console.log(`✅ Created ${def.name}: ${channelId}`);
        
        // Wait 2 seconds between creates
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Disconnect
      agent.stop();

      setChannelIds(channels as ChannelIds);
      console.log('✅ All channels created:', channels);

    } catch (err) {
      console.error('❌ Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="font-adonis text-4xl mb-4">Admin Setup</h1>
          <p className="font-georgia-pro text-lg text-gray-600 mb-6">
            Connect your Space Owner wallet to continue
          </p>
          <ConnectButton client={client} theme="light" />
        </div>
      </div>
    );
  }

  if (account.address.toLowerCase() !== MASTER_ADMIN_ADDRESS.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="font-adonis text-4xl mb-4 text-red-600">Access Denied</h1>
          <p className="font-georgia-pro text-lg text-gray-600">
            Only the Space Owner wallet can access this page.
          </p>
          <p className="font-mono text-sm text-gray-400 mt-4">
            Connected: {account.address}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-adonis text-5xl mb-2">Virtual Sharding Setup</h1>
        <p className="font-georgia-pro text-gray-600 mb-8">
          Create the 4 channels needed for the virtual sharding system
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="font-adonis text-2xl mb-4">Instructions</h2>
          <ol className="font-georgia-pro space-y-2 list-decimal list-inside">
            <li>Connect your Space Owner wallet (the one with the Space NFT)</li>
            <li>Click &quot;Create Channels&quot; button below</li>
            <li>Approve transactions in MetaMask (4-5 signatures required)</li>
            <li>Copy the channel IDs that appear</li>
            <li>Add them as environment variables in Vercel</li>
          </ol>
        </div>

        <div className="bg-blue-50 border border-blue-300 rounded-lg p-6 mb-6">
          <h2 className="font-adonis text-xl mb-2 text-blue-800">🔐 Secure & Simple</h2>
          <p className="font-georgia-pro text-sm text-blue-800">
            Your private key never leaves MetaMask. You&apos;ll sign each transaction directly in your wallet.
            This is the old-school Web3 way - your keys, your control! 🗝️
          </p>
        </div>

        {!channelIds && !error && (
          <button
            onClick={handleCreateChannels}
            disabled={isCreating}
            className="w-full bg-black text-white font-georgia-pro text-lg py-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {isCreating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Creating Channels... (Check MetaMask)
              </span>
            ) : (
              '🏗️ Create Channels with MetaMask'
            )}
          </button>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="font-adonis text-2xl text-red-600 mb-2">Error</h2>
            <p className="font-georgia-pro text-red-800">{error}</p>
            <button
              onClick={handleCreateChannels}
              className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {channelIds && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h2 className="font-adonis text-2xl text-green-600 mb-4">✅ Channels Created!</h2>
            
            <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
              <p className="font-georgia-pro text-sm text-gray-600 mb-2">
                Add these to your Vercel environment variables:
              </p>
              <div className="font-mono text-sm space-y-2">
                <div className="bg-gray-100 p-3 rounded">
                  <code>NEXT_PUBLIC_CHANNEL_CONTRIBUTORS={channelIds.contributors}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`NEXT_PUBLIC_CHANNEL_CONTRIBUTORS=${channelIds.contributors}`)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
                <div className="bg-gray-100 p-3 rounded">
                  <code>NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A={channelIds.participantsA}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A=${channelIds.participantsA}`)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
                <div className="bg-gray-100 p-3 rounded">
                  <code>NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B={channelIds.participantsB}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B=${channelIds.participantsB}`)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
                <div className="bg-gray-100 p-3 rounded">
                  <code>NEXT_PUBLIC_CHANNEL_FILES={channelIds.files}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`NEXT_PUBLIC_CHANNEL_FILES=${channelIds.files}`)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-adonis text-lg mb-2">⚠️ Next Steps</h3>
              <ol className="font-georgia-pro text-sm space-y-1 list-decimal list-inside">
                <li>Go to Vercel → Your Project → Settings → Environment Variables</li>
                <li>Add all 4 variables above to both Preview and Production</li>
                <li>Trigger a redeploy</li>
                <li>The app will now use the 4-channel system! 🎉</li>
              </ol>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <a
            href="/admin"
            className="font-georgia-pro text-gray-600 hover:text-black underline"
          >
            ← Back to Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
