'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useCreateChannel, useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { ethers } from 'ethers';

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

export default function AdminSetupContent() {
  const account = useActiveAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelIds, setChannelIds] = useState<ChannelIds | null>(null);
  const [isConnectingTowns, setIsConnectingTowns] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;

  // Wait for client-side mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only use Towns hooks after mounted
  const townsConfig = isMounted ? townsEnv().makeTownsConfig('omega') : null;
  const agentConnection = isMounted ? useAgentConnection() : { connect: null, isAgentConnected: false };
  const channelHook = isMounted ? useCreateChannel(spaceId) : { createChannel: null };

  const { connect, isAgentConnected } = agentConnection;
  const { createChannel } = channelHook;

  // Auto-connect to Towns when wallet is connected
  useEffect(() => {
    if (!isMounted || !townsConfig) return;

    const connectToTowns = async () => {
      if (account && !isAgentConnected && !isConnectingTowns && typeof window !== 'undefined' && window.ethereum && connect) {
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
  }, [account, isAgentConnected, isConnectingTowns, connect, townsConfig, isMounted]);

  const handleCreateChannels = async () => {
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    if (!isAgentConnected) {
      setError('Not connected to Towns Protocol. Please wait...');
      return;
    }

    if (!createChannel) {
      setError('Channel creation not ready. Please refresh the page.');
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
      
      // Get ethers signer from MetaMask
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Create all 4 channels
      const channels: Record<string, string> = {};

      for (const def of CHANNEL_DEFINITIONS) {
        console.log(`Creating channel: ${def.name}`);
        
        // Use the hook's createChannel function
        const channelId = await createChannel(
          def.name,
          signer,
          { topic: def.description }
        );
        
        channels[def.key] = channelId;
        console.log(`✅ Created ${def.name}: ${channelId}`);
        
        // Wait 2 seconds between creates
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      setChannelIds(channels as ChannelIds);
      console.log('✅ All channels created:', channels);

    } catch (err) {
      console.error('❌ Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  // Show loading until mounted
  if (!isMounted) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center p-12">
          <span className="animate-spin text-4xl">⏳</span>
          <span className="ml-4 font-georgia-pro text-lg">Initializing...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-adonis text-5xl mb-2">Virtual Sharding Setup</h1>
      <p className="font-georgia-pro text-gray-600 mb-8">
        Create the 4 channels needed for the virtual sharding system
      </p>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="font-adonis text-2xl mb-4">Instructions</h2>
        <ol className="font-georgia-pro space-y-2 list-decimal list-inside">
          <li>Connect your Space Owner wallet (the one with the Space NFT)</li>
          <li>Wait for Towns Protocol connection</li>
          <li>Click &quot;Create Channels&quot; button below</li>
          <li>Approve transactions in MetaMask (4 signatures required)</li>
          <li>Copy the channel IDs that appear</li>
          <li>Add them as environment variables in Vercel</li>
        </ol>
      </div>

      {/* Connection Status */}
      {account && (
        <div className={`border rounded-lg p-4 mb-6 ${
          isAgentConnected 
            ? 'bg-green-50 border-green-300' 
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-center gap-2">
            {isAgentConnected ? (
              <>
                <span className="text-green-600 text-xl">✅</span>
                <span className="font-georgia-pro text-green-800">
                  Connected to Towns Protocol
                </span>
              </>
            ) : (
              <>
                <span className="animate-spin text-yellow-600 text-xl">⏳</span>
                <span className="font-georgia-pro text-yellow-800">
                  Connecting to Towns Protocol...
                </span>
              </>
            )}
          </div>
        </div>
      )}

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
          disabled={isCreating || !isAgentConnected || !account}
          className="w-full bg-black text-white font-georgia-pro text-lg py-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {isCreating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              Creating Channels... (Check MetaMask)
            </span>
          ) : !account ? (
            '⏳ Connect Wallet First...'
          ) : !isAgentConnected ? (
            '⏳ Waiting for Towns Connection...'
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
  );
}
