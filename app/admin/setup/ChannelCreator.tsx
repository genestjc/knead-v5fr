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
  rpcUrl?: string;
}

export function ChannelCreator({ spaceId, rpcUrl }: ChannelCreatorProps) {
  const account = useActiveAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelIds, setChannelIds] = useState<ChannelIds | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentChannel, setCurrentChannel] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const { createChannel } = useCreateChannel(spaceId);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Exponential backoff retry
  const createWithRetry = async (def: typeof CHANNEL_DEFINITIONS[0], signer: ethers.Signer, maxRetries = 3) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        addLog(`Attempt ${attempt + 1}/${maxRetries}: Creating ${def.name}...`);
        
        const channelId = await createChannel(
          def.name,
          signer,
          { topic: def.description }
        );
        
        addLog(`✅ Success: ${def.name} → ${channelId}`);
        return channelId;
        
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        addLog(`❌ Attempt ${attempt + 1} failed: ${errorMsg}`);
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 15s, 30s, 45s
          const waitTime = (attempt + 1) * 15000;
          addLog(`⏳ Waiting ${waitTime / 1000}s before retry...`);
          await new Promise(r => setTimeout(r, waitTime));
        } else {
          throw new Error(`Failed after ${maxRetries} attempts: ${errorMsg}`);
        }
      }
    }
    throw new Error('Should not reach here');
  };

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
    setLogs([]);

    try {
      addLog('🏗️ Starting channel creation...');
      addLog(`🔗 RPC: ${rpcUrl || 'Default (public)'}`);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const channels: Record<string, string> = {};

      for (let i = 0; i < CHANNEL_DEFINITIONS.length; i++) {
        const def = CHANNEL_DEFINITIONS[i];
        
        setCurrentStep(i + 1);
        setCurrentChannel(def.name);
        
        addLog(`\n[${i + 1}/${CHANNEL_DEFINITIONS.length}] Starting: ${def.name}`);
        
        // Create with retry
        const channelId = await createWithRetry(def, signer);
        channels[def.key] = channelId;
        
        // Wait between channels (except after last one)
        if (i < CHANNEL_DEFINITIONS.length - 1) {
          addLog(`⏳ Waiting 20 seconds before next channel...`);
          await new Promise(resolve => setTimeout(resolve, 20000)); // 20 seconds
        }
      }

      setChannelIds(channels as ChannelIds);
      setCurrentChannel('');
      addLog('\n✅ All channels created successfully!');

    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      addLog(`\n❌ FATAL ERROR: ${errorMsg}`);
      setError(errorMsg);
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
          <li>Approve each MetaMask signature (may retry if RPC fails)</li>
          <li><strong>Be patient</strong> - can take 2-3 minutes with retries</li>
          <li>Copy the channel IDs that appear</li>
          <li>Add them as environment variables in Vercel</li>
        </ol>
      </div>

      {/* RPC Warning */}
      {(!rpcUrl || rpcUrl.includes('mainnet.base.org')) && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
          <h3 className="font-adonis text-lg text-red-700 mb-2">⚠️ RPC Warning</h3>
          <p className="font-georgia-pro text-sm text-red-800">
            You&apos;re using a public RPC which has strict rate limits. This will likely fail!
            Set <code className="bg-red-100 px-1">NEXT_PUBLIC_BASE_RPC_URL</code> to your Alchemy endpoint.
          </p>
        </div>
      )}

      <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-xl">✅</span>
          <div>
            <span className="font-georgia-pro text-green-800">
              Connected to Towns Protocol - Ready to create channels!
            </span>
            <p className="text-xs font-mono text-gray-600 mt-1">
              RPC: {rpcUrl?.includes('alchemy') ? '✅ Alchemy' : '⚠️ Public (may fail)'}
            </p>
          </div>
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
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / CHANNEL_DEFINITIONS.length) * 100}%` }}
            />
          </div>
          
          {/* Live Logs */}
          <div className="bg-white border border-gray-300 rounded p-3 max-h-40 overflow-y-auto">
            <p className="text-xs font-mono text-gray-500 mb-2">Live Progress:</p>
            {logs.map((log, i) => (
              <p key={i} className="text-xs font-mono text-gray-700">{log}</p>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-300 rounded-lg p-6 mb-6">
        <h2 className="font-adonis text-xl mb-2 text-blue-800">🔐 Secure & Simple</h2>
        <p className="font-georgia-pro text-sm text-blue-800">
          Your private key never leaves MetaMask. You&apos;ll sign each transaction directly in your wallet.
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
            '🏗️ Create All 4 Channels (2-3 minutes)'
          )}
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="font-adonis text-2xl text-red-600 mb-2">Error</h2>
          <p className="font-georgia-pro text-red-800 mb-4">{error}</p>
          
          {/* Show logs */}
          <details className="mb-4">
            <summary className="cursor-pointer text-sm font-georgia-pro text-gray-600">View full log</summary>
            <div className="bg-white border border-gray-300 rounded p-3 mt-2 max-h-60 overflow-y-auto">
              {logs.map((log, i) => (
                <p key={i} className="text-xs font-mono text-gray-700">{log}</p>
              ))}
            </div>
          </details>
          
          <button
            onClick={handleCreateChannels}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
          >
            Retry All Channels
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
