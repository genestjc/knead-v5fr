'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';

interface Contributor {
  id: string;
  address: string;
  displayName: string;
  avatar?: string;
  role: string;
  contributorType: string;
}

// Minting Form Component
function AddContributorForm({ onMintSuccess }: { onMintSuccess: () => void }) {
  const account = useActiveAccount();
  const [recipient, setRecipient] = useState('');
  const [role, setRole] = useState<'appointed' | 'invited' | 'earned'>('invited');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) {
      setMessage('Error: Admin wallet not connected.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/mint-contributor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientAddress: recipient,
          role: role,
          adminAddress: account.address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`Success! NFT minted. Tx: ${data.transactionHash.slice(0,10)}...`);
        setRecipient('');
        onMintSuccess(); // Refresh the contributor list
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
                <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">Recipient Wallet Address</label>
                <input type="text" id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black" placeholder="0x..." required />
            </div>
            <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">Contributor Role</label>
                <select id="role" value={role} onChange={(e) => setRole(e.target.value as any)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black">
                    <option value="invited">Invited (1.0x)</option>
                    <option value="appointed">Appointed (0.8x)</option>
                </select>
            </div>
            <div>
                <button type="submit" disabled={isLoading} className="w-full py-2 px-4 bg-black text-white font-semibold rounded-md hover:bg-gray-800 disabled:bg-gray-400">
                    {isLoading ? 'Minting...' : 'Mint Contributor NFT'}
                </button>
            </div>
        </form>
        {message && <p className="mt-4 text-sm text-center break-words">{message}</p>}
    </div>
  );
}

// List of On-Chain Contributors
function ContributorList({ contributors, onRevokeSuccess }: { contributors: Contributor[], onRevokeSuccess: () => void }) {
    const account = useActiveAccount();
    const [revokingId, setRevokingId] = useState<string | null>(null);

    const handleRevoke = async (contributorId: string) => {
        if (!account?.address) {
          alert('Error: Admin wallet not connected.');
          return;
        }
        if (!confirm(`Are you sure you want to revoke this contributor's status? This will burn their NFT.`)) {
            return;
        }

        setRevokingId(contributorId);
        try {
            const response = await fetch(`/api/admin/contributors/${contributorId}?adminAddress=${account.address}`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to revoke contributor');
            }
            alert('Contributor revoked successfully!');
            onRevokeSuccess();
        } catch (error) {
            console.error('Revoke error:', error);
            alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setRevokingId(null);
        }
    };
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-8">
            <h3 className="font-adonis text-2xl mb-4">Current On-Chain Contributors</h3>
            <div className="space-y-3">
                {contributors.length > 0 ? contributors.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div>
                            <p className="font-semibold text-gray-800">{c.displayName}</p>
                            <p className="text-sm text-gray-500 font-mono">{`${c.address.slice(0, 6)}...${c.address.slice(-4)}`}</p>
                            <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{c.contributorType}</span>
                        </div>
                        <button 
                            onClick={() => handleRevoke(c.id)}
                            disabled={revokingId === c.id}
                            className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded-md hover:bg-red-200 disabled:opacity-50"
                        >
                            {revokingId === c.id ? 'Revoking...' : 'Revoke'}
                        </button>
                    </div>
                )) : <p className="text-gray-500">No on-chain contributors found.</p>}
            </div>
        </div>
    );
}


// Main ContributorManager Component
export function ContributorManager({ adminAddress }: { adminAddress: string }) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchContributors = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/contributors?adminAddress=${adminAddress}`);
      const data = await response.json();
      if (data.success) {
        setContributors(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to fetch contributors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContributors();
  }, [adminAddress]);

  return (
    <div>
      <h2 className="font-adonis text-3xl mb-6">On-Chain Contributor Management</h2>
      <AddContributorForm onMintSuccess={fetchContributors} />
      {isLoading ? (
        <p className="text-center mt-8">Loading contributors...</p>
      ) : (
        <ContributorList contributors={contributors} onRevokeSuccess={fetchContributors} />
      )}
    </div>
  );
}
