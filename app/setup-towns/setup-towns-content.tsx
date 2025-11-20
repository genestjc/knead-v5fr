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

      // Try ThirdWeb's suggestion: use arrays for tuples
      const spaceInfo = {
        metadata: ["Knead Chat", ""], // Array format for tuple
        membership: [
          "Knead Membership", // name
          "KNEAD", // symbol
          0n, // price
          0n, // maxSupply
          0n, // duration
          "0x0000000000000000000000000000000000000000", // currency
          "0x0000000000000000000000000000000000000000", // pricingModule
          account.address // feeRecipient
        ],
        permissions: ["Read", "Write"],
        requirements: [
          true, // everyone
          [], // users
          "0x", // ruleData
          false // syncEntitlements
        ],
        channel: [
          "general", // name
          "Main chat channel", // description
          "0x0000000000000000000000000000000000000000000000000000000000000000" // roleId
        ]
      };

      console.log('📝 Space config (array format):', JSON.stringify(spaceInfo, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      , 2));
      
      console.log('📝 Metadata specifically:', JSON.stringify(spaceInfo.metadata));

      // Prepare transaction
      const transaction = prepareContractCall({
        contract,
        method: "function createSpace((tuple(string name, string uri) metadata, tuple(string name, string symbol, uint256 price, uint256 maxSupply, uint64 duration, address currency, address pricingModule, address feeRecipient) membership, string[] permissions, tuple(bool everyone, address[] users, bytes ruleData, bool syncEntitlements) requirements, tuple(string name, string description, bytes32 roleId) channel)) returns (address)",
        params: [spaceInfo],
      });

      console.log('📝 Transaction prepared, sending...');

      // Send transaction
      const result = await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Transaction sent:', result.transactionHash);
      console.log('📋 All logs:', result.logs);

      // Parse logs to get Space address
      const spaceCreatedLog = result.logs?.find(
        (log: any) => log.eventName === "SpaceCreated"
      );

      const spaceAddress = spaceCreatedLog?.args?.space?.toString();

      if (!spaceAddress) {
        console.error('Could not find space address in logs:', result.logs);
        throw new Error('Could not extract Space address from transaction');
      }

      console.log('🎉 Space created at address:', spaceAddress);
      const spaceId = spaceAddress;

      setSuccess({
        spaceAddress,
        spaceId,
        txHash: result.transactionHash,
      });

    } catch (err: any) {
      console.error('❌ Error creating space:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        reason: err.reason,
        data: err.data,
        stack: err.stack,
      });
      
      let errorMessage = err.message || 'Failed to create space';
      
      if (err.message?.includes('user rejected') || err.message?.includes('User rejected')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (err.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for gas fees';
      } else if (err.message?.includes('Invalid ABI')) {
        errorMessage = 'ABI encoding error - trying array format now';
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
            <h2 className="font-adonis text-2xl mb-4">Copy These to Vercel Environment Variables:</h2>

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
                Space ID (same as address):
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
            <li>Connect your personal wallet (you'll own the Space NFT)</li>
            <li>Click "Create Space" to call SpaceFactory contract on Base</li>
            <li>Sign the transaction in your wallet (~$1-2 gas fee)</li>
            <li>Get your Space ID and Channel ID</li>
            <li>Add them to Vercel environment variables</li>
          </ol>
        </div>

        <div className="mb-

