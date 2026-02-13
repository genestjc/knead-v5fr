/**
 * Admin Setup Page for Virtual Sharding
 * 
 * Simple UI for creating the 4 channels needed for virtual sharding.
 * Shows channel IDs in copy-paste friendly format for Vercel env vars.
 */

'use client';

import { useState } from 'react';
import { useActiveAccount, ConnectButton } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';

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

export default function AdminSetupPage() {
  const account = useActiveAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelIds, setChannelIds] = useState<ChannelIds | null>(null);
  
  const client = getClient();
  const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET || '';

  const handleCreateChannels = async () => {
    setIsCreating(true);
    setError(null);
    setChannelIds(null);

    try {
      console.log('🏗️ Creating channels...');
      
      const response = await fetch('/api/admin/create-channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.channels) {
        console.log('✅ Channels created:', data.channels);
        setChannelIds(data.channels);
      } else {
        console.error('❌ Failed to create channels:', data.error);
        setError(data.error || 'Failed to create channels');
      }
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
            Connect your admin wallet to continue
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
            Only the master admin can access this page.
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
            <li>Make sure <code className="bg-gray-200 px-2 py-1 rounded">ADMIN_PRIVATE_KEY</code> is set in Vercel environment variables</li>
            <li>Click &quot;Create Channels&quot; button below</li>
            <li>Copy the channel IDs that appear</li>
            <li>Add them as environment variables in Vercel (both Preview and Production)</li>
            <li>Redeploy the app to use the new channels</li>
          </ol>
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
                Creating Channels...
              </span>
            ) : (
              '🏗️ Create Channels'
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
                <li>Trigger a redeploy (or merge this PR)</li>
                <li>The app will now use the 4-channel system</li>
                <li>Optional: Remove ADMIN_PRIVATE_KEY from Vercel (no longer needed)</li>
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
