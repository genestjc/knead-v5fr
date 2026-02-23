'use client';

import { useState } from 'react';
import { useActiveAccount, useSendTransaction } from 'thirdweb/react';
import { getContract, prepareContractCall, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { client } from '@/thirdweb-client';

interface MonthlyMintManagerProps {
  adminAddress: string;
}

const MEMBERSHIP_ABI = [
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
] as const;

export function MonthlyMintManager({ adminAddress }: MonthlyMintManagerProps) {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction } = useSendTransaction();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'warning' | null;
    message: string;
    txHash?: string;
  }>({ type: null, message: '' });

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account?.address) {
      setStatus({ type: 'error', message: 'Connect your admin wallet to mint' });
      return;
    }

    if (!recipientAddress.trim()) {
      setStatus({
        type: 'error',
        message: 'Please enter a wallet address',
      });
      return;
    }

    // Basic address validation
    if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 42) {
      setStatus({
        type: 'error',
        message: 'Invalid Ethereum address format',
      });
      return;
    }

    setIsLoading(true);
    setStatus({ type: null, message: '' });

    try {
      // PRIMARY: Direct wallet mint (bypasses Engine server wallet). Engine API route at /api/mint-vip kept as fallback - see route.ts
      const contractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
      if (!contractAddress) {
        setStatus({ type: 'error', message: 'NFT contract address is not configured.' });
        return;
      }

      const contract = getContract({
        client,
        chain: base,
        address: contractAddress,
        abi: MEMBERSHIP_ABI,
      });

      // Check if recipient already has a membership
      const balance = await readContract({
        contract,
        method: "function balanceOf(address account, uint256 id) view returns (uint256)",
        params: [recipientAddress as `0x${string}`, 1n],
      });

      if (balance > 0n) {
        setStatus({
          type: 'warning',
          message: 'This wallet already has a premium membership!',
        });
        return;
      }

      const transaction = prepareContractCall({
        contract,
        method: "function mint(address to, uint256 id, uint256 amount)",
        params: [recipientAddress as `0x${string}`, 1n, 1n],
      });

      const result = await sendTransaction(transaction);

      setStatus({
        type: 'success',
        message: 'Premium membership minted successfully!',
        txHash: result.transactionHash,
      });
      setRecipientAddress(''); // Clear input on success
    } catch (error: any) {
      console.error('Mint error:', error);
      setStatus({
        type: 'error',
        message: error?.message || 'Network error. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('✅ Copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-adonis text-2xl mb-2">Knead Monthly Mint</h2>
        <p className="font-georgia-pro text-gray-600">
          Mint premium memberships for Knead community members
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-adonis text-lg mb-2">ℹ️ Premium Membership</h3>
        <ul className="font-georgia-pro text-sm space-y-1 list-disc list-inside text-gray-700">
          <li>Unlocks full chat participation</li>
          <li>Access to exclusive events and discussions</li>
          <li>NFT-based verification on Base network</li>
          <li>One membership per wallet address</li>
        </ul>
      </div>

      {/* Mint Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-adonis text-xl mb-4">Mint New Membership</h3>
        
        <form onSubmit={handleMint} className="space-y-4">
          <div>
            <label className="block font-georgia-pro text-sm font-medium mb-2">
              Recipient Wallet Address *
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500 font-georgia-pro">
              Enter the Ethereum wallet address to receive premium membership
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !recipientAddress.trim()}
            className="w-full bg-black text-white font-georgia-pro py-3 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {isLoading ? '⏳ Confirm in MetaMask...' : '🎫 Mint Premium Membership'}
          </button>
        </form>
      </div>

      {/* Status Display */}
      {status.type && (
        <div
          className={`border rounded-lg p-6 ${
            status.type === 'success'
              ? 'bg-green-50 border-green-200'
              : status.type === 'warning'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <h3
            className={`font-adonis text-xl mb-2 ${
              status.type === 'success'
                ? 'text-green-600'
                : status.type === 'warning'
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {status.type === 'success' ? '✅ Success!' : status.type === 'warning' ? '⚠️ Warning' : '❌ Error'}
          </h3>

          <p className="font-georgia-pro text-sm text-gray-700 mb-3">{status.message}</p>

          {status.txHash && (
            <div className="space-y-2">
              <p className="font-georgia-pro text-sm text-gray-700">Transaction Hash:</p>
              <div className="flex items-center gap-2 bg-white p-3 rounded border border-gray-300">
                <code className="font-mono text-sm flex-1 break-all">{status.txHash}</code>
                <button
                  onClick={() => copyToClipboard(status.txHash!)}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
              </div>
              <a
                href={`https://basescan.org/tx/${status.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-georgia-pro text-xs text-blue-600 underline"
              >
                View on Basescan ↗
              </a>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-adonis text-lg mb-2">📋 How to Mint</h3>
        <ol className="font-georgia-pro text-sm space-y-1 list-decimal list-inside text-gray-700">
          <li>Enter the recipient's Ethereum wallet address (0x...)</li>
          <li>Click "Mint Premium Membership"</li>
          <li>Confirm the transaction in MetaMask</li>
          <li>Transaction hash will be displayed on success with a Basescan link</li>
          <li>Recipient can now access premium features</li>
        </ol>
      </div>
    </div>
  );
}
