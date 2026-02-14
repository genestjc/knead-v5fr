'use client';

import { useState, useEffect } from 'react';
import { useSpace, useAgentConnection } from '@towns-protocol/react-sdk';
import { useActiveAccount } from 'thirdweb/react';

export default function ListChannelsContent() {
  const account = useActiveAccount();
  const { isAgentConnected } = useAgentConnection();
  const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
  
  const { data: space, isLoading, error } = useSpace(spaceId);
  const [channels, setChannels] = useState<any[]>([]);

  useEffect(() => {
    if (space?.channelIds) {
      console.log('📋 All channel IDs:', space.channelIds);
      
      // Convert to array with metadata
      const channelList = space.channelIds.map((id: string, index: number) => ({
        index,
        id,
        // Try to get name from metadata if available
        name: space.channels?.[id]?.name || `Channel ${index + 1}`,
      }));
      
      setChannels(channelList);
    }
  }, [space]);

  // Wait for wallet connection
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="font-georgia-pro text-lg mb-4">Please connect your wallet</p>
          <a 
            href="/chat-test"
            className="text-blue-600 hover:underline font-georgia-pro"
          >
            Go to Chat to connect →
          </a>
        </div>
      </div>
    );
  }

  // Wait for Towns agent connection
  if (!isAgentConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro mb-2">Connecting to Towns Protocol...</p>
          <p className="font-georgia-pro text-sm text-gray-500">
            If this takes too long, <a href="/chat-test" className="text-blue-600 underline">go to chat first</a> to establish connection
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro">Loading space data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="font-georgia-pro text-red-600 mb-4">Error: {error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-adonis text-4xl mb-2">Channel ID Inspector</h1>
        <p className="font-georgia-pro text-gray-600 mb-8">
          Space: {spaceId?.slice(0, 20)}...
        </p>

        {/* Raw Data */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="font-adonis text-xl mb-4">Space Raw Data</h2>
          <details>
            <summary className="cursor-pointer text-sm text-gray-600 mb-2">
              Click to expand full space object
            </summary>
            <pre className="text-xs overflow-auto bg-white p-4 rounded border max-h-96">
              {JSON.stringify(space, null, 2)}
            </pre>
          </details>
        </div>

        {/* Channel List */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="font-adonis text-2xl mb-4">
            All Channels ({channels.length})
          </h2>

          {channels.length === 0 ? (
            <p className="font-georgia-pro text-gray-500">No channels found</p>
          ) : (
            <div className="space-y-4">
              {channels.map((channel, idx) => (
                <div 
                  key={channel.id}
                  className="bg-gray-50 border border-gray-300 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-adonis text-lg">
                          #{idx + 1}: {channel.name}
                        </span>
                      </div>
                      
                      <div className="font-mono text-xs break-all text-gray-700 bg-white p-3 rounded border">
                        {channel.id}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(channel.id);
                        alert('Copied to clipboard!');
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 whitespace-nowrap"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assignment Helper */}
        {channels.length >= 4 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h2 className="font-adonis text-2xl mb-4 text-green-800">
              📝 Assignment Suggestion
            </h2>
            <p className="font-georgia-pro text-sm text-green-800 mb-4">
              Since you have {channels.length} channels, here's a suggested mapping.
              You can pick ANY 4 channels and assign them to your env vars:
            </p>

            <div className="space-y-3">
              <div className="bg-white p-4 rounded border border-green-300">
                <p className="font-mono text-xs text-gray-600 mb-1">
                  NEXT_PUBLIC_CHANNEL_CONTRIBUTORS
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-100 p-2 rounded break-all">
                    {channels[0]?.id || 'N/A'}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`NEXT_PUBLIC_CHANNEL_CONTRIBUTORS=${channels[0]?.id}`);
                      alert('Copied env var!');
                    }}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    📋
                  </button>
                </div>
              </div>

              <div className="bg-white p-4 rounded border border-green-300">
                <p className="font-mono text-xs text-gray-600 mb-1">
                  NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-100 p-2 rounded break-all">
                    {channels[1]?.id || 'N/A'}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A=${channels[1]?.id}`);
                      alert('Copied env var!');
                    }}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    📋
                  </button>
                </div>
              </div>

              <div className="bg-white p-4 rounded border border-green-300">
                <p className="font-mono text-xs text-gray-600 mb-1">
                  NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-100 p-2 rounded break-all">
                    {channels[2]?.id || 'N/A'}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B=${channels[2]?.id}`);
                      alert('Copied env var!');
                    }}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    📋
                  </button>
                </div>
              </div>

              <div className="bg-white p-4 rounded border border-green-300">
                <p className="font-mono text-xs text-gray-600 mb-1">
                  NEXT_PUBLIC_CHANNEL_FILES
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-100 p-2 rounded break-all">
                    {channels[3]?.id || 'N/A'}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`NEXT_PUBLIC_CHANNEL_FILES=${channels[3]?.id}`);
                      alert('Copied env var!');
                    }}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* Copy All Button */}
              <button
                onClick={() => {
                  const allEnvVars = `NEXT_PUBLIC_CHANNEL_CONTRIBUTORS=${channels[0]?.id}\nNEXT_PUBLIC_CHANNEL_PARTICIPANTS_A=${channels[1]?.id}\nNEXT_PUBLIC_CHANNEL_PARTICIPANTS_B=${channels[2]?.id}\nNEXT_PUBLIC_CHANNEL_FILES=${channels[3]?.id}`;
                  navigator.clipboard.writeText(allEnvVars);
                  alert('All 4 env vars copied to clipboard!');
                }}
                className="w-full mt-4 bg-green-600 text-white font-georgia-pro py-3 rounded-lg hover:bg-green-700"
              >
                📋 Copy All 4 Env Vars
              </button>
            </div>

            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded p-4">
              <h3 className="font-adonis text-lg mb-2 text-yellow-800">⚠️ Next Steps</h3>
              <ol className="font-georgia-pro text-sm space-y-1 list-decimal list-inside text-yellow-800">
                <li>Copy the 4 env vars above</li>
                <li>Go to Vercel → Settings → Environment Variables</li>
                <li>Add all 4 to Preview and Production</li>
                <li>Trigger a redeploy</li>
                <li>Enable virtual sharding in code (set isVirtualShardingEnabled to true)</li>
              </ol>
            </div>
          </div>
        )}

        {/* Navigation */}
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
