'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useCreateChannel } from '@towns-protocol/react-sdk';
import { ethers } from 'ethers';

interface ChannelIds {
  contributors?: string;
  participantsA?: string;
  participantsB?: string;
  files?: string;
}

const CHANNEL_DEFINITIONS = [
  {
    name: 'knead-contributors',
    description: 'All contributor messages (text only)',
    key: 'contributors' as const,
    envVar: 'NEXT_PUBLIC_CHANNEL_CONTRIBUTORS',
  },
  {
    name: 'knead-participants-a',
    description: 'Participant messages during events (shard A: address 0-7)',
    key: 'participantsA' as const,
    envVar: 'NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A',
  },
  {
    name: 'knead-participants-b',
    description: 'Participant messages during events (shard B: address 8-f)',
    key: 'participantsB' as const,
    envVar: 'NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B',
  },
  {
    name: 'knead-files',
    description: 'All file uploads and IPFS content',
    key: 'files' as const,
    envVar: 'NEXT_PUBLIC_CHANNEL_FILES',
  },
];

interface ChannelCreatorProps {
  spaceId: string;
  rpcUrl?: string;
}

export function ChannelCreator({ spaceId, rpcUrl }: ChannelCreatorProps) {
  const account = useActiveAccount();
  const [channelIds, setChannelIds] = useState<ChannelIds>({});
  const [creatingIndex, setCreatingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { createChannel } = useCreateChannel(spaceId);

  const handleCreateSingleChannel = async (index: number) => {
    const def = CHANNEL_DEFINITIONS[index];
    
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    if (!createChannel) {
      alert('Channel creation not ready');
      return;
    }

    if (typeof window === 'undefined' || !window.ethereum) {
      alert('MetaMask not detected');
      return;
    }

    setCreatingIndex(index);
    setError(null);

    try {
      console.log(`Creating channel: ${def.name}`);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const channelId = await createChannel(
        def.name,
        signer,
        { topic: def.description }
      );
      
      console.log(`✅ Created ${def.name}: ${channelId}`);

      setChannelIds(prev => ({
        ...prev,
        [def.key]: channelId,
      }));

    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error(`❌ Failed to create ${def.name}:`, errorMsg);
      setError(`Failed to create ${def.name}: ${errorMsg}`);
    } finally {
      setCreatingIndex(null);
    }
  };

  const allChannelsCreated = CHANNEL_DEFINITIONS.every(def => channelIds[def.key]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-adonis text-5xl mb-2">Virtual Sharding Setup</h1>
      <p className="font-georgia-pro text-gray-600 mb-8">
        Create the 4 channels needed for the virtual sharding system
      </p>

      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-6 mb-6">
        <h2 className="font-adonis text-xl mb-2 text-yellow-800">⚠️ Create ONE Channel at a Time</h2>
        <p className="font-georgia-pro text-sm text-yellow-800">
          Due to Towns Protocol rate limits, you must create each channel individually.
          <strong> Wait at least 5 minutes between creations.</strong> You can even do one per day if needed!
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="font-adonis text-2xl mb-4">Instructions</h2>
        <ol className="font-georgia-pro space-y-2 list-decimal list-inside">
          <li>Click &quot;Create&quot; for the first channel</li>
          <li>Sign in MetaMask</li>
          <li>Wait for success, then copy the channel ID</li>
          <li><strong>Wait 5+ minutes</strong></li>
          <li>Repeat for the next channel</li>
          <li>Once all 4 are created, add them to Vercel</li>
        </ol>
      </div>

      <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-xl">✅</span>
          <span className="font-georgia-pro text-green-800">
            Connected to Towns Protocol - Ready!
          </span>
        </div>
      </div>

      {/* Channel Creation Buttons */}
      <div className="space-y-4 mb-6">
        {CHANNEL_DEFINITIONS.map((def, index) => {
          const channelId = channelIds[def.key];
          const isCreating = creatingIndex === index;
          const isCreated = !!channelId;

          return (
            <div 
              key={def.key}
              className={`border rounded-lg p-6 ${
                isCreated ? 'bg-green-50 border-green-300' : 'bg-white border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-adonis text-xl">
                      {index + 1}. {def.name}
                    </h3>
                    {isCreated && <span className="text-green-600 text-xl">✅</span>}
                  </div>
                  <p className="font-georgia-pro text-sm text-gray-600 mb-3">
                    {def.description}
                  </p>

                  {isCreated && (
                    <div className="bg-white border border-gray-300 rounded p-3">
                      <p className="text-xs text-gray-600 mb-1">Channel ID:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono flex-1 break-all">
                          {channelId}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(`${def.envVar}=${channelId}`)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          title="Copy env var"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleCreateSingleChannel(index)}
                  disabled={isCreating || isCreated || (creatingIndex !== null)}
                  className="bg-black text-white font-georgia-pro px-6 py-3 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition whitespace-nowrap"
                >
                  {isCreating ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Creating...
                    </span>
                  ) : isCreated ? (
                    '✅ Created'
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="font-adonis text-lg text-red-600 mb-2">Error</h3>
          <p className="font-georgia-pro text-sm text-red-800">{error}</p>
          <p className="font-georgia-pro text-xs text-red-600 mt-2">
            Wait 5-10 minutes and try again. Towns Protocol nodes are rate limited.
          </p>
        </div>
      )}

      {/* Success Summary */}
      {allChannelsCreated && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="font-adonis text-2xl text-green-600 mb-4">🎉 All Channels Created!</h2>
          
          <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
            <p className="font-georgia-pro text-sm text-gray-600 mb-2">
              Copy all environment variables at once:
            </p>
            <div className="bg-gray-100 p-4 rounded">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
{`NEXT_PUBLIC_CHANNEL_CONTRIBUTORS=${channelIds.contributors}
NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A=${channelIds.participantsA}
NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B=${channelIds.participantsB}
NEXT_PUBLIC_CHANNEL_FILES=${channelIds.files}`}
              </pre>
              <button
                onClick={() => {
                  const envVars = `NEXT_PUBLIC_CHANNEL_CONTRIBUTORS=${channelIds.contributors}\nNEXT_PUBLIC_CHANNEL_PARTICIPANTS_A=${channelIds.participantsA}\nNEXT_PUBLIC_CHANNEL_PARTICIPANTS_B=${channelIds.participantsB}\nNEXT_PUBLIC_CHANNEL_FILES=${channelIds.files}`;
                  navigator.clipboard.writeText(envVars);
                }}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                📋 Copy All
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-adonis text-lg mb-2">⚠️ Next Steps</h3>
            <ol className="font-georgia-pro text-sm space-y-1 list-decimal list-inside">
              <li>Go to Vercel → Your Project → Settings → Environment Variables</li>
              <li>Add all 4 variables to both Preview and Production</li>
              <li>Trigger a redeploy</li>
              <li>Enable virtual sharding in the code</li>
              <li>Test the 4-channel system! 🎉</li>
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
