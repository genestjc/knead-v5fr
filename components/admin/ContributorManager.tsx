'use client';

import { useState } from 'react';

// A simple form to mint Contributor NFTs
function AddContributorForm() {
  const [recipient, setRecipient] = useState('');
  const [role, setRole] = useState<'appointed' | 'invited' | 'earned'>('invited');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/mint-contributor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientAddress: recipient,
          role: role,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`Success! Contributor NFT minted in transaction: ${data.transactionHash}`);
        setRecipient('');
      } else {
        throw new Error(data.error || 'Failed to mint NFT.');
      }
    } catch (error) {
      console.error(error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="font-adonis text-2xl mb-4">Mint New Contributor NFT</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
                    Recipient Wallet Address
                </label>
                <input
                    type="text"
                    id="recipient"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
                    placeholder="0x..."
                    required
                />
            </div>
            <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    Contributor Role
                </label>
                <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
                >
                    <option value="invited">Invited (1.0x)</option>
                    <option value="appointed">Appointed (0.8x)</option>
                    <option value="earned">Earned (1.5x)</option>
                </select>
            </div>
            <div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2 px-4 bg-black text-white font-semibold rounded-md hover:bg-gray-800 disabled:bg-gray-400"
                >
                    {isLoading ? 'Minting...' : 'Mint Contributor NFT'}
                </button>
            </div>
        </form>
        {message && <p className="mt-4 text-sm text-center break-words">{message}</p>}
    </div>
  );
}

// Your main ContributorManager component
export function ContributorManager({ adminAddress }: { adminAddress: string }) {
  // You would likely have other UI here, like a list of current contributors
  return (
    <div>
      <h2 className="font-adonis text-3xl mb-6">Contributor Management</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <AddContributorForm />
        {/* You could have another panel here to list or manage existing contributors */}
      </div>
    </div>
  );
}
