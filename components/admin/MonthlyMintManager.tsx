'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';

interface MonthlyMintManagerProps {
  adminAddress: string;
}

export function MonthlyMintManager({ adminAddress }: MonthlyMintManagerProps) {
  const account = useActiveAccount();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'warning' | null; message: string; txHash?: string; }>({ type: null, message: '' });

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
      // Uses Engine server wallet (owner of membership contract) to mint.
      // Direct wallet minting is not possible as mint() is owner-only on the contract.
      const response = await fetch('/api/mint-vip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_address: recipientAddress,
          adminAddress: account.address,
        }),
      });

      const data = await response.json();

      if (data.success && !data.alreadyMinted) {
        setStatus({
          type: 'success',
          message: 'Premium membership mint enqueued successfully!',
          txHash: data.transactionHash || data.transactionId,
        });
        setRecipientAddress('');
      } else if (data.alreadyMinted) {
        setStatus({
          type: 'warning',
          message: 'This wallet already has a premium membership!',
        });
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Minting failed. Please try again.',
        });
      }
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
            {isLoading ? '⏳ Minting...' : '🎫 Mint Premium Membership'}
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
              <p className="font-georgia-pro text-sm text-gray-700">Transaction ID:</p>
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
          <li>Wait for Engine server wallet to process (~30-60 seconds)</li>
          <li>Transaction ID will be displayed on success</li>
          <li>Recipient can now access premium features</li>
        </ol>
      </div>
    </div>
  );
}