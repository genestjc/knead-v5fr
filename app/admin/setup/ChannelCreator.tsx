'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useCreateChannel } from '@towns-protocol/react-sdk';
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

interface ChannelCreatorProps {
  spaceId: string;
}

export function ChannelCreator({ spaceId }: ChannelCreatorProps) {
  const account = useActiveAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelIds, setChannelIds] = useState<ChannelIds | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentChannel, setCurrentChannel] = useState('');

  const { createChannel } = useCreateChannel(spaceId);

  const handleCreateChannels = async () => {
    if (!account) {
      setError('Please connect your wallet first');
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
    setCurrentStep(0);

    try {
      console.log('🏗️ Creating channels with MetaMask...');
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const channels: Record<string, string> = {};

      for (let i = 0; i < CHANNEL_DEFINITIONS.length; i++) {
        const def = CHANNEL_DEFINITIONS[i];
        
        setCurrentStep(i + 1);
        setCurrentChannel(def.name);
        console.log(`[${i + 1}/${CHANNEL_DEFINITIONS.length}] Creating channel: ${def.name}`);
        
        try {
          const channelId = await createChannel(
            def.name,
            signer,
            { topic: def.description }
          );
          
          channels[def.key] = channelId;
          console.log(`✅ Created ${def.name}: ${channelId}`);
          
          // ✅ LONGER DELAY - Give Towns Protocol time to process
          if (i < CHANNEL_DEFINITIONS.length - 1) {
            console.log(`⏳ Waiting 10 seconds before next channel...`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
          }
          
        } catch (channelError) {
          console.error(`❌ Failed to create ${def.name}:`, channelError);
          
          // Retry once after 15 seconds
          console.log(`⏳ Retrying ${def.name} in 15 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 15000));
          
          const channelId = await createChannel(
            def.name,
            signer,
            { topic: def.description }
          );
          
          channels[def.key] = channelId;
          console.log(`✅ Created ${def.name} (retry): ${channelId}`);
          
          if (i < CHANNEL_DEFINITIONS.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      }

      setChannelIds(channels as ChannelIds);
      setCurrentChannel('');
      console.log('✅ All channels created:', channels);

    } catch (err) {
      console.error('❌ Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setCurrentChannel('');
    } finally {
      setIsCreating(false);
      setCurrentStep(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-adonis text-5xl mb-2">Virtual Sharding Setup</h1>
      <p className="font-georgia-pro text-gray-600 mb-8">
        Create the 4 channels needed for the virtual sharding system
      </p>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="font-adonis text-2xl mb-4">Instructions</h2>
        <ol className="font-georgia-pro space-y-2 list-decimal list-inside">
          <li>Click &quot;Create Channels&quot; button below</li>
          <li>Approve transactions in MetaMask (4 signatures required)</li>
          <li><strong>Wait patiently</strong> - takes ~60 seconds total (10 sec delay between each)</li>
          <li>Copy the channel IDs that appear</li>
          <li>Add them as environment variables in Vercel</li>
        </ol>
      </div>

      <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-xl">✅</span>
          <span className="font-georgia-pro text-green-800">
            Connected to Towns Protocol - Ready to create channels!
          </span>
        </div>
      </div>

      {/* Progress Indicator */}
      {isCreating && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="animate-spin text-2xl">⏳</span>
            <div>
              <p className="font-adonis text-lg">
                Creating Channel {currentStep} of {CHANNEL_DEFINITIONS.length}
              </p>
              <p className="font-mono text-sm text-gray-600">{currentChannel}</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / CHANNEL_DEFINITIONS.length) * 100}%` }}
            />
          </div>
          
          <p className="text-xs text-gray-600 mt-2">
            ⏱️ This takes time - each channel needs 10 seconds to process. Please don&apos;t close this tab!
          </p>
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
          disabled={isCreating}
          className="w-full bg-black text-white font-georgia-pro text-lg py-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {isCreating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              Creating... ({currentStep}/{CHANNEL_DEFINITIONS.length})
            </span>
          ) : (
            '🏗️ Create All 4 Channels (Takes ~60 seconds)'
          )}
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="font-adonis text-2xl text-red-600 mb-2">Error</h2>
          <p className="font-georgia-pro text-red-800">{error}</p>
          <p className="font-mono text-xs text-gray-600 mt-2">
            Failed at: {currentChannel || 'Unknown'}
          </p>
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
