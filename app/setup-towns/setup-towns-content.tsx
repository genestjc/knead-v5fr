'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { createThirdwebClient, getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { base } from 'thirdweb/chains';

const SPACE_FACTORY_ADDRESS = '0x9978c826d93883701522d2ca645d5436e5654252';

const SPACE_FACTORY_ABI = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { internalType: "string", name: "name", type: "string" },
              { internalType: "string", name: "uri", type: "string" }
            ],
            internalType: "struct IArchitectBase.Metadata",
            name: "metadata",
            type: "tuple"
          },
          {
            components: [
              { internalType: "string", name: "name", type: "string" },
              { internalType: "string", name: "symbol", type: "string" },
              { internalType: "uint256", name: "price", type: "uint256" },
              { internalType: "uint256", name: "maxSupply", type: "uint256" },
              { internalType: "uint64", name: "duration", type: "uint64" },
              { internalType: "address", name: "currency", type: "address" },
              { internalType: "address", name: "pricingModule", type: "address" },
              { internalType: "address", name: "feeRecipient", type: "address" }
            ],
            internalType: "struct IMembershipBase.Membership",
            name: "membership",
            type: "tuple"
          },
          {
            internalType: "string[]",
            name: "permissions",
            type: "string[]"
          },
          {
            components: [
              { internalType: "bool", name: "everyone", type: "bool" },
              { internalType: "address[]", name: "users", type: "address[]" },
              { internalType: "bytes", name: "ruleData", type: "bytes" },
              { internalType: "bool", name: "syncEntitlements", type: "bool" }
            ],
            internalType: "struct IArchitectBase.MembershipRequirements",
            name: "requirements",
            type: "tuple"
          },
          {
            components: [
              { internalType: "string", name: "name", type: "string" },
              { internalType: "string", name: "description", type: "string" },
              { internalType: "bytes32", name: "roleId", type: "bytes32" }
            ],
            internalType: "struct IArchitectBase.ChannelInfo",
            name: "channel",
            type: "tuple"
          }
        ],
        internalType: "struct IArchitectBase.SpaceInfo",
        name: "spaceInfo",
        type: "tuple"
      }
    ],
    name: "createSpace",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "space", type: "address" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "string", name: "name", type: "string" }
    ],
    name: "SpaceCreated",
    type: "event"
  }
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
      console.log('🚀 Creating space with user wallet:', account.address);

      const client = createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
      });

      const contract = getContract({
        client,
        chain: base,
        address: SPACE_FACTORY_ADDRESS,
        abi: SPACE_FACTORY_ABI,
      });

      const spaceInfo = {
        metadata: ["Knead Chat", ""],
        membership: [
          "Knead Membership",
          "KNEAD",
          0n,
          0n,
          0n,
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          account.address
        ],
        permissions: ["Read", "Write"],
        requirements: [
          true,
          [],
          "0x",
          false
        ],
        channel: [
          "general",
          "Main chat channel",
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        ]
      };

      console.log('📝 Space config:', spaceInfo);

      const transaction = prepareContractCall({
        contract,
        method: "function createSpace((tuple(string name, string uri) metadata, tuple(string name, string symbol, uint256 price, uint256 maxSupply, uint64 duration, address currency, address pricingModule, address feeRecipient) membership, string[] permissions, tuple(bool everyone, address[] users, bytes ruleData, bool syncEntitlements) requirements, tuple(string name, string description, bytes32 roleId) channel)) returns (address)",
        params: [spaceInfo],
      });

      console.log('📝 Sending transaction...');

      const result = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Transaction sent:', result.transactionHash);

      const spaceCreatedLog = result.logs?.find(
        (log: any) => log.eventName === "SpaceCreated"
      );

      const spaceAddress = spaceCreatedLog?.args?.space?.toString();

      if (!spaceAddress) {
        throw new Error('Could not extract Space address from transaction');
      }

      console.log('🎉 Space created at:', spaceAddress);

      setSuccess({
        spaceAddress,
        spaceId: spaceAddress,
        txHash: result.transactionHash,
      });

    } catch (err: any) {
      console.error('❌ Error:', err);
      
      let errorMessage = err.message || 'Failed to create space';
      
      if (err.message?.includes('user rejected')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (err.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for gas fees';
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
            <li>Click Create Space</li>
            <li>Sign the transaction (~$1-2 gas)</li>
            <li>Get your Space ID</li>
            <li>Add to Vercel environment variables</li>
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
              Using array format for tuples as suggested by ThirdWeb support.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
