'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { createThirdwebClient, sendTransaction, prepareTransaction } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { ethers } from 'ethers';

const SPACE_FACTORY_ADDRESS = '0x9978c826d93883701522d2ca645d5436e5654252';

const SPACE_FACTORY_ABI = [
  "function createSpace(tuple(tuple(string name, string uri) metadata, tuple(string name, string symbol, uint256 price, uint256 maxSupply, uint64 duration, address currency, address pricingModule, address feeRecipient) membership, string[] permissions, tuple(bool everyone, address[] users, bytes ruleData, bool syncEntitlements) requirements, tuple(string name, string description, bytes32 roleId) channel) spaceInfo) returns (address)",
  "event SpaceCreated(address indexed space, address indexed owner, string name)"
];

export default function SetupTownsContent() {
  const account = useActiveAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ spaceAddress: string; spaceId: string; txHash: string } | null>(null);

  const handleCreateSpace = async () => {
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      console.log('🚀 Creating space with ethers encoding');
      console.log('Wallet:', account.address);

      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
      });

      // Use ethers to encode the function call
      const iface = new ethers.Interface(SPACE_FACTORY_ABI);

      // Build the struct with objects (not arrays)
      const spaceInfo = {
        metadata: {
          name: "Knead Chat",
          uri: ""
        },
        membership: {
          name: "Knead Membership",
          symbol: "KNEAD",
          price: 0n,
          maxSupply: 0n,
          duration: 0n,
          currency: "0x0000000000000000000000000000000000000000",
          pricingModule: "0x0000000000000000000000000000000000000000",
          feeRecipient: account.address
        },
        permissions: ["Read", "Write"],
        requirements: {
          everyone: true,
          users: [],
          ruleData: "0x",
          syncEntitlements: false
        },
        channel: {
          name: "general",
          description: "Main chat channel",
          roleId: "0x0000000000000000000000000000000000000000000000000000000000000000"
        }
      };

      console.log('📝 Space config:', JSON.stringify(spaceInfo, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      , 2));

      console.log('🔧 Encoding with ethers.Interface...');
      const encodedData = iface.encodeFunctionData("createSpace", [spaceInfo]);
      console.log('✅ Encoded successfully:', encodedData.slice(0, 66) + '...');

      // Prepare raw transaction
      const transaction = prepareTransaction({
        to: SPACE_FACTORY_ADDRESS,
        chain: base,
        client,
        data: encodedData,
        value: 0n,
      });

      console.log('📤 Sending transaction...');

      const result = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Transaction sent:', result.transactionHash);
      console.log('📋 Logs:', result.logs?.length || 0);

      // Parse logs with ethers
      let spaceAddress: string | null = null;

      for (const log of result.logs || []) {
        try {
          const parsed = iface.parseLog({
            topics: log.topics as string[],
            data: log.data as string,
          });
          
          if (parsed && parsed.name === 'SpaceCreated') {
            spaceAddress = parsed.args.space;
            console.log('✅ SpaceCreated event found!');
            console.log('   Space:', parsed.args.space);
            console.log('   Owner:', parsed.args.owner);
            console.log('   Name:', parsed.args.name);
            break;
          }
        } catch (e) {
          // Not our event, continue
        }
      }

      if (!spaceAddress) {
        console.error('❌ No SpaceCreated event found');
        throw new Error('Could not find Space address in transaction logs');
      }

      console.log('🎉 Space created successfully at:', spaceAddress);

      setSuccess({
        spaceAddress,
        spaceId: spaceAddress,
        txHash: result.transactionHash,
      });

    } catch (err: any) {
      console.error('❌ Error creating space:', err);
      console.error('Full error:', {
        message: err.message,
        code: err.code,
        reason: err.reason,
        data: err.data,
      });
      
      let errorMessage = err.message || 'Failed to create space';
      
      if (err.message?.includes('user rejected') || err.message?.includes('User rejected')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (err.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for gas fees';
      } else if (err.reason) {
        errorMessage = `Contract error: ${err.reason}`;
      }
      
      setError(errorMessage);
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
            <h2 className="font-adonis text-2xl mb-4">Copy These to Vercel:</h2>

            <div className="mb-4">
              <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-2">
                Space Address:
              </label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all border border-gray-300">
                {success.spaceAddress}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(success.spaceAddress);
                  alert('Space address copied!');
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                📋 Copy Space Address
              </button>
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
              <div>NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={success.spaceId}</div>
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
            <li>Connect your wallet (you will own the Space NFT)</li>
            <li>Click Create Space to call SpaceFactory on Base</li>
            <li>Sign the transaction (~$1-2 gas fee)</li>
            <li>Get your Space ID</li>
            <li>Add to Vercel environment variables</li>
          </ol>
        </div>

        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="font-georgia-pro text-sm">
            <strong>🔧 Method:</strong> Using ethers.js for reliable ABI encoding (bypasses ThirdWeb's nested tuple parser)
          </p>
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
                Make sure you have ~$2 ETH on Base mainnet for gas fees.
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
              Using ethers.Interface for ABI encoding - bypasses ThirdWeb's tuple parser issues.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
