'use client';

import { useState } from 'react';

export default function SetupTownsContent() {
  const [spaceId, setSpaceId] = useState('');
  const [channelId, setChannelId] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-3xl w-full bg-gray-50 rounded-lg p-8">
        <div className="text-center mb-8">
          <h1 className="font-adonis text-4xl mb-2">Setup Knead Chat Space</h1>
          <p className="font-georgia-pro text-gray-600">
            Follow these steps to create your Towns Protocol space
          </p>
        </div>

        {/* Step 1 */}
        <div className="mb-6 p-6 bg-white border-2 border-gray-200 rounded-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <div className="flex-1">
              <h3 className="font-adonis text-xl mb-2">Go to Towns.com</h3>
              <p className="font-georgia-pro text-sm text-gray-600 mb-3">
                Visit the official Towns Protocol interface to create your space.
              </p>
              <a
                href="https://towns.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-black text-white rounded-full font-georgia-pro text-sm hover:bg-gray-800 transition"
              >
                Open Towns.com →
              </a>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="mb-6 p-6 bg-white border-2 border-gray-200 rounded-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <div className="flex-1">
              <h3 className="font-adonis text-xl mb-2">Connect Your Wallet</h3>
              <p className="font-georgia-pro text-sm text-gray-600 mb-2">
                Connect MetaMask or Coinbase Wallet to Base mainnet.
              </p>
              <ul className="font-georgia-pro text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Network: <strong>Base</strong></li>
                <li>Chain ID: <strong>8453</strong></li>
                <li>You'll need ~$1 ETH for gas</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="mb-6 p-6 bg-white border-2 border-gray-200 rounded-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <div className="flex-1">
              <h3 className="font-adonis text-xl mb-2">Create Space</h3>
              <p className="font-georgia-pro text-sm text-gray-600 mb-2">
                Look for "Create Space" or "New Space" button, then:
              </p>
              <ul className="font-georgia-pro text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Name: <strong>"Knead Chat"</strong></li>
                <li>Description: "Community chat for Knead"</li>
                <li>Membership: Public/Open (you can change later)</li>
                <li>Sign the transaction in your wallet</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="mb-6 p-6 bg-white border-2 border-blue-200 rounded-lg bg-blue-50">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
              4
            </div>
            <div className="flex-1">
              <h3 className="font-adonis text-xl mb-2">Enter Your Space Details</h3>
              <p className="font-georgia-pro text-sm text-gray-600 mb-4">
                After creating your space, copy the Space ID and paste it below. The Channel ID is typically the same as the Space ID.
              </p>
              
              <div className="mb-4">
                <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-2">
                  Space ID:
                </label>
                <input
                  type="text"
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  placeholder="Paste your Space ID here (from Towns.com URL or transaction)"
                  className="w-full p-3 border-2 border-gray-300 rounded font-mono text-sm bg-white"
                />
                <p className="font-georgia-pro text-xs text-gray-500 mt-1">
                  💡 Tip: Check the URL on Towns.com (e.g., towns.com/spaces/<strong>YOUR_SPACE_ID</strong>) or look in your transaction logs on BaseScan
                </p>
              </div>

              <div className="mb-4">
                <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-2">
                  Default Channel ID (optional):
                </label>
                <input
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="Usually same as Space ID - leave blank to auto-fill"
                  className="w-full p-3 border-2 border-gray-300 rounded font-mono text-sm bg-white"
                />
              </div>

              {spaceId && (
                <div className="mt-6 p-4 bg-gray-900 text-green-400 rounded font-mono text-xs overflow-x-auto">
                  <div className="mb-1">NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={spaceId}</div>
                  <div>NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={channelId || spaceId}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 5 */}
        {spaceId && (
          <div className="mb-6 p-6 bg-white border-2 border-green-200 rounded-lg bg-green-50">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                5
              </div>
              <div className="flex-1">
                <h3 className="font-adonis text-xl mb-2">Add to Vercel</h3>
                <ol className="font-georgia-pro text-sm space-y-2 list-decimal list-inside">
                  <li>Copy the environment variables above</li>
                  <li>
                    Go to{' '}
                    <a 
                      href="https://vercel.com/genestjcs-projects/knead-v5fr/settings/environment-variables" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Vercel Settings ↗
                    </a>
                  </li>
                  <li>Click "Add New" and paste both variables</li>
                  <li>Click "Save" and wait for automatic redeploy</li>
                  <li>Test at <code className="bg-green-100 px-1 rounded">/chat-test</code></li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-georgia-pro font-semibold mb-2">❓ Need Help Finding Your Space ID?</h3>
          <p className="font-georgia-pro text-sm text-yellow-800 mb-2">
            If you created a space but can't find the ID:
          </p>
          <ul className="font-georgia-pro text-sm text-yellow-800 list-disc list-inside space-y-1">
            <li><strong>Check the URL:</strong> Go to Towns.com, open your space, and look at the browser URL</li>
            <li><strong>Check BaseScan:</strong> Go to <a href="https://basescan.org" target="_blank" rel="noopener noreferrer" className="underline">BaseScan</a>, search your wallet address, find the "createSpace" transaction, and look in the Logs tab</li>
            <li><strong>Ask Towns:</strong> Join their Discord or Twitter <a href="https://twitter.com/townsxyz" target="_blank" rel="noopener noreferrer" className="underline">@townsxyz</a></li>
          </ul>
        </div>

        <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
          <p className="font-georgia-pro text-xs text-gray-600">
            <strong>ℹ️ Why manual setup?</strong> Towns Protocol requires a personal wallet signature to create spaces (you'll own the Space NFT). Server wallets can't create spaces, so we use the official Towns.com interface instead.
          </p>
        </div>
      </div>
    </div>
  );
}
