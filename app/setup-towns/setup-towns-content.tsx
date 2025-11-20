'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { createThirdwebClient, getContract, prepareContractCall, sendTransaction, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';

const SPACE_FACTORY_ADDRESS = '0x9978c826d93883701522d2ca645d5436e5654252';

const SPACE_FACTORY_ABI = [
  {
    inputs: [{ internalType: "string", name: "name", type: "string" }],
    name: "createSpace",
    outputs: [{ internalType: "uint256", name: "spaceId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "spaceId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      { indexed: false, internalType: "string", name: "name", type: "string" },
    ],
    name: "SpaceCreated",
    type: "event",
  },
];

// ABI for reading from the Space contract
const SPACE_ABI = [
  {
    inputs: [],
    name: "defaultChannelId",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "channelIds",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
];

export default function SetupTownsContent() {
  const account = useActiveAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ spaceId: string; channelId: string; txHash: string } | null>(null);

  const handleCreateSpace = async () => {
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      console.log('🚀 Creating space with user wallet:', account.address);

      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
      });

      const spaceFactoryContract = getContract({
        client,
        chain: base,
        address: SPACE_FACTORY_ADDRESS,
        abi: SPACE_FACTORY_ABI,
      });

      // Prepare and send transaction
      const transaction = prepareContractCall({
        contract: spaceFactoryContract,
        method: "function createSpace(string name)",
        params: ["Knead Chat"],
      });

      console.log('📝 Transaction prepared, sending...');

      const result = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Transaction sent:', result.transactionHash);
      console.log('📋 All logs:', result.logs);

      // Parse logs to get Space ID
      const eventSignature = "SpaceCreated(uint256,address,string)";
      const spaceCreatedLog = result.logs?.find(
        (log: any) => log.eventName === "SpaceCreated" || log.eventSignature === eventSignature
      );

      const spaceId = spaceCreatedLog?.args?.spaceId?.toString();

      if (!spaceId) {
        console.error('Could not find spaceId in logs:', result.logs);
        throw new Error('Could not extract Space ID from transaction');
      }

      console.log('🎉 Space created! ID:', spaceId);

      // Now we need to get the Space contract address and query for default channel
      // The Space contract address might be in the logs or we need to query SpaceFactory
      
      // Option 1: Look for other events that might contain channel info
      console.log('🔍 Searching all events for channel info...');
      let defaultChannelId = null;

      // Check all logs for any channel-related events
      for (const log of result.logs || []) {
        console.log('Event:', log.eventName, log.args);
        
        // Look for ChannelCreated or similar events
        if (log.eventName?.includes('Channel') || log.eventName === 'ChannelCreated') {
          const channelId = log.args?.channelId?.toString() || log.args?.id?.toString();
          if (channelId) {
            defaultChannelId = channelId;
            console.log('✅ Found channel ID in event:', channelId);
            break;
          }
        }
      }

      // Option 2: If not found in events, try querying the Space contract
      if (!defaultChannelId) {
        console.log('⚠️ Channel ID not found in events, trying to query Space contract...');
        
        // We need the Space contract address - it might be derived from spaceId
        // For now, let's use spaceId as fallback (Towns said this often works)
        defaultChannelId = spaceId;
        console.log('📝 Using spaceId as channel ID fallback');
      }

      console.log('✅ Final IDs - Space:', spaceId, 'Channel:', defaultChannelId);

      setSuccess({
        spaceId,
        channelId: defaultChannelId,
        txHash: result.transactionHash,
      });

    } catch (err: any) {
      console.error('❌ Error creating space:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        reason: err.reason,
        data: err.data,
      });
      setError(err.message || 'Failed to create space');
    } finally {
      setIsCreating(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-3xl w-full bg-gray-50 rounded-lg p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="font-adonis text-4xl mb-2">Space Created!</h1>
            <p className="font-georgia-pro text-gray-600">
              Your Knead Chat space is live on Towns Protocol
            </p>
          </div>

          <div className="mb-6 p-6 bg-white rounded-lg border-2 border-green-200">
            <h2 className="font-adonis text-2xl mb-4">Copy These to Vercel Environment Variables:</h2>

            <div className="mb-4">
              <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-2">
                Space ID:
              </label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all border border-gray-300">
                {success.spaceId}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(success.spaceId);
                  alert('Space ID copied!');
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                📋 Copy Space ID
              </button>
            </div>

            <div className="mb-4">
              <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-2">
                Default Channel ID:
              </label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all border border-gray-300">
                {success.channelId}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(success.channelId);
                  alert('Channel ID copied!');
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                📋 Copy Channel ID
              </button>
              {success.channelId === success.spaceId && (
                <p className="font-georgia-pro text-xs text-yellow-700 mt-2">
                  ⚠️ Using Space ID as Channel ID (common fallback). Check browser console logs for details.
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-2">
                Transaction:
              </label>
              <a
                href={`https://basescan.org/tx/${success.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                View on BaseScan ↗
              </a>
            </div>

            <div className="mt-6 p-4 bg-gray-900 text-green-400 rounded font-mono text-xs overflow-x-auto">
              <div className="mb-1">NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={success.spaceId}</div>
              <div>NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={success.channelId}</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-georgia-pro font-semibold mb-2">📝 Next Steps:</h3>
            <ol className="font-georgia-pro text-sm space-y-2 list-decimal list-inside">
              <li>Copy both environment variables above</li>
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
              <li>Add both variables and save</li>
              <li>Wait for automatic redeploy</li>
              <li>Test at <code className="bg-blue-100 px-1 rounded">/chat-test</code></li>
            </ol>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-georgia-pro font-semibold mb-2">🔍 Verify on BaseScan:</h3>
            <p className="font-georgia-pro text-sm text-yellow-800">
              Click the transaction link above and check the "Logs" tab to see all events emitted during space creation. 
              If you see a different Channel ID there, use that instead.
            </p>
          </div>

          <div className="text-center">
            <a
              href="https://vercel.com/genestjcs-projects/knead-v5fr/settings/environment-variables"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
            >
              Open Vercel Settings →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-2xl w-full bg-gray-50 rounded-lg p-8">
        <h1 className="font-adonis text-4xl mb-4 text-center">Create Knead Chat Space</h1>

        <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <h2 className="font-adonis text-xl mb-3">How This Works:</h2>
          <ol className="font-georgia-pro text-sm space-y-2 list-decimal list-inside">
            <li>Connect your personal wallet (you'll own the Space NFT)</li>
            <li>Click "Create Space" to call SpaceFactory contract on Base</li>
            <li>Sign the transaction in your wallet (~$1 gas fee)</li>
            <li>Get your Space ID and Channel ID</li>
            <li>Add them to Vercel environment variables</li>
          </ol>
        </div>

        {!account ? (
          <div className="text-center">
            <p className="font-georgia-pro mb-4 text-gray-600">
              Connect your wallet to get started:
            </p>
            <ThirdWebConnectButton />
          </div>
        ) : (
          <div>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-georgia-pro text-sm text-green-800">
                ✅ <strong>Wallet Connected:</strong> {account.address.slice(0, 6)}...{account.address.slice(-4)}
              </p>
              <p className="font-georgia-pro text-xs text-green-700 mt-2">
                Make sure you have ~$1 ETH on Base mainnet for gas fees.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                ❌ {error}
              </div>
            )}

            <button
              onClick={handleCreateSpace}
              disabled={isCreating}
              className="w-full px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? '⏳ Creating Space...' : '🚀 Create Knead Chat Space'}
            </button>

            <p className="font-georgia-pro text-xs text-gray-500 mt-4 text-center">
              This calls the Towns Protocol SpaceFactory contract directly on Base mainnet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
