'use client';

import { useState } from 'react';

interface ChannelManagerProps {
  adminAddress: string;
}

export function ChannelManager({ adminAddress }: ChannelManagerProps) {
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; channelId?: string; error?: string } | null>(null);

  const handleCreateChannel = async () => {
    if (!channelName.trim()) {
      alert('Please enter a channel name');
      return;
    }

    setIsCreating(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/create-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: channelName,
          description: channelDescription,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        // Clear form on success
        setChannelName('');
        setChannelDescription('');
      }
    } catch (error) {
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
          <li>Add <code className="bg-blue-100 px-2 py-1 rounded">ADMIN_PRIVATE_KEY</code> to Vercel (Preview environment only)</li>
          <li>Fill in the channel details below</li>
          <li>Click "Create Channel"</li>
          <li>Copy the channel ID and add it to your code/env vars</li>
          <li>Remove <code className="bg-blue-100 px-2 py-1 rounded">ADMIN_PRIVATE_KEY</code> from Vercel when done</li>
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
            {isCreating ? '⏳ Creating...' : '🏗️ Create Channel'}
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
            </div>
          )}
          
          {result.error && (
            <div>
              <p className="font-georgia-pro text-sm text-red-800">{result.error}</p>
              {result.error.includes('ADMIN_PRIVATE_KEY') && (
                <div className="mt-3 text-sm">
                  <p className="font-georgia-pro text-red-700">
                    💡 Make sure <code className="bg-red-100 px-2 py-1 rounded">ADMIN_PRIVATE_KEY</code> is 
                    set in your Vercel environment variables.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Security Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-adonis text-lg mb-2 text-yellow-800">🔐 Security Note</h3>
        <p className="font-georgia-pro text-sm text-yellow-800">
          Your private key is NEVER sent to the browser. It stays securely in Vercel environment variables.
          The API route on the server uses it to sign transactions. Always remove it from Vercel after creating channels.
        </p>
      </div>
    </div>
  );
}
