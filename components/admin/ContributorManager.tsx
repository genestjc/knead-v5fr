'use client';

import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ContributorPoolWidget } from './ContributorPoolWidget';

interface Contributor {
  id: string;
  address: string;
  displayName: string;
  avatar?: string;
  role: string;
  contributorType: string;
}

interface ContributorStats {
  address: string;
  typeLabel: string;
  cType: number;
  weeklyBudget: number;
  lockedAllowance: number;
  cashbackEarnings: number;
  cashbackClaimed: number;
  totalTipped: number;
  daysUntilReset: number;
}

function getNextSundayDate(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const daysUntilSunday = (7 - day) % 7;
  const nextSunday = new Date(now);
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(0, 0, 0, 0);
  return nextSunday.toUTCString();
}

// Minting Form Component
function AddContributorForm({ onMintSuccess }: { onMintSuccess: () => void }) {
  const account = useActiveAccount();
  const [recipient, setRecipient] = useState('');
  const [role, setRole] = useState<'appointed' | 'invited' | 'earned'>('invited');
  const [weeklyBudget, setWeeklyBudget] = useState('100');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) {
      setMessage('Error: Admin wallet not connected.');
      return;
    }

    const budgetNum = parseFloat(weeklyBudget);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      setMessage('Error: Weekly budget must be a positive number.');
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
          weeklyBudget: budgetNum,
          adminAddress: account.address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Submitted! NFT mint queued (Token ID ${data.tokenId}) with ${weeklyBudget} TOWNS/week budget. Engine transaction ID: ${data.mintTransactionId?.slice(0,10) ?? 'N/A'}... — will confirm on-chain in ~30-60 seconds.`);
        setRecipient('');
        setWeeklyBudget('100'); // Reset to default
        onMintSuccess();
      } else {
        throw new Error(data.error || 'Failed to add contributor.');
      }
    } catch (error) {
      console.error(error);
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="font-adonis text-2xl mb-4">Add New Contributor</h3>
        <p className="text-sm text-gray-600 mb-4">
          Mints an NFT and sets up the contributor in the rewards contract.
        </p>
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
                  Contributor Type
                </label>
                <select 
                  id="role" 
                  value={role} 
                  onChange={(e) => setRole(e.target.value as any)} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
                >
                    <option value="appointed">Appointed (0.8x multiplier, 3 invites)</option>
                    <option value="invited">Invited (1.0x multiplier, 2 invites)</option>
                    <option value="earned">Earned (1.5x multiplier, 3 invites)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Determines their reward multiplier
                </p>
            </div>
            
            <div>
                <label htmlFor="weeklyBudget" className="block text-sm font-medium text-gray-700">
                  Weekly Budget (TOWNS)
                </label>
                <input 
                  type="number" 
                  id="weeklyBudget" 
                  value={weeklyBudget} 
                  onChange={(e) => setWeeklyBudget(e.target.value)} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black" 
                  placeholder="100" 
                  min="1"
                  step="1"
                  required 
                />
                <p className="mt-1 text-xs text-gray-500">
                  How many TOWNS they can award per week (recommended: 50-500)
                </p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-xs text-gray-700">
                  💡 <strong>Budget Recommendations:</strong>
                </p>
                <ul className="text-xs text-gray-600 mt-1 ml-4 list-disc">
                  <li>Conservative: 50 TOWNS/week</li>
                  <li>Standard: 100 TOWNS/week</li>
                  <li>Generous: 500 TOWNS/week</li>
                </ul>
              </div>
            
            <div>
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full py-2 px-4 bg-black text-white font-semibold rounded-md hover:bg-gray-800 disabled:bg-gray-400"
                >
                    {isLoading ? 'Setting up contributor...' : 'Add Contributor'}
                </button>
            </div>
        </form>
        {message && (
          <div className={`mt-4 p-3 rounded-md ${message.startsWith('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-sm break-words">{message}</p>
          </div>
        )}
    </div>
  );
}

// Weekly Allowance Management Section
function WeeklyAllowanceManager({ onStatsRefreshed }: { onStatsRefreshed?: () => void }) {
  const [isAllocating, setIsAllocating] = useState(false);
  const [allocationResult, setAllocationResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleAllocateToAll = async () => {
    if (!confirm('Allocate weekly allowances to all contributors? This sends a blockchain transaction.')) {
      return;
    }
    setIsAllocating(true);
    setAllocationResult(null);
    setIsError(false);
    try {
      const response = await fetch('/api/admin/allocate-allowances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorAddresses: [] }),
      });
      const data = await response.json();
      if (data.success) {
        setAllocationResult(`✅ ${data.message} Tx: ${data.transactionHash?.slice(0, 10)}...`);
        onStatsRefreshed?.();
      } else {
        throw new Error(data.error || 'Allocation failed');
      }
    } catch (error) {
      setIsError(true);
      setAllocationResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAllocating(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-8">
      <h3 className="font-adonis text-2xl mb-4">⚡ Weekly Allowance Management</h3>
      <div className="flex gap-4 mb-4 flex-wrap">
        <button
          onClick={handleAllocateToAll}
          disabled={isAllocating}
          className="py-2 px-4 bg-black text-white font-semibold rounded-md hover:bg-gray-800 disabled:bg-gray-400"
        >
          {isAllocating ? 'Allocating...' : 'Allocate to All Contributors'}
        </button>
        {onStatsRefreshed && (
          <button
            onClick={onStatsRefreshed}
            className="py-2 px-4 border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-50"
          >
            Refresh Stats
          </button>
        )}
      </div>
      <p className="text-sm text-gray-600">
        Next auto-allocation: {getNextSundayDate()}
      </p>
      {allocationResult && (
        <div className={`mt-4 p-3 rounded-md ${isError ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <p className="text-sm break-words">{allocationResult}</p>
        </div>
      )}
    </div>
  );
}

// Contributor Stats Table
function ContributorStatsTable({ stats, onBudgetUpdated }: {
  stats: ContributorStats[];
  onBudgetUpdated: () => void;
}) {
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [newBudgetValue, setNewBudgetValue] = useState('');
  const [updatingAddress, setUpdatingAddress] = useState<string | null>(null);
  const [allocatingAddress, setAllocatingAddress] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleUpdateBudget = async (address: string) => {
    const budget = parseFloat(newBudgetValue);
    if (isNaN(budget) || budget <= 0) {
      alert('Budget must be a positive number.');
      return;
    }
    setUpdatingAddress(address);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/admin/contributors/update-budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorAddress: address, newBudget: budget }),
      });
      const data = await response.json();
      if (data.success) {
        setStatusMessage(`✅ Budget updated. Tx: ${data.transactionHash?.slice(0, 10)}...`);
        setEditingAddress(null);
        onBudgetUpdated();
      } else {
        throw new Error(data.error || 'Failed to update budget');
      }
    } catch (error) {
      setStatusMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpdatingAddress(null);
    }
  };

  const handleAllocateNow = async (address: string) => {
    setAllocatingAddress(address);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/admin/allocate-allowances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorAddresses: [address] }),
      });
      const data = await response.json();
      if (data.success) {
        setStatusMessage(`✅ Allowance allocated. Tx: ${data.transactionHash?.slice(0, 10)}...`);
        onBudgetUpdated();
      } else {
        throw new Error(data.error || 'Allocation failed');
      }
    } catch (error) {
      setStatusMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setAllocatingAddress(null);
    }
  };

  if (stats.length === 0) {
    return <p className="text-gray-500 mt-4">No contributor stats available.</p>;
  }

  return (
    <div className="mt-4">
      {statusMessage && (
        <div className={`mb-4 p-3 rounded-md text-sm ${statusMessage.startsWith('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {statusMessage}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-200 rounded-md">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Weekly Budget</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cashback</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Tipped</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Days Until Reset</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stats.map((s) => (
              <tr key={s.address} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-gray-700">
                  {`${s.address.slice(0, 6)}...${s.address.slice(-4)}`}
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    {s.typeLabel}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {editingAddress === s.address ? (
                    <input
                      type="number"
                      value={newBudgetValue}
                      onChange={(e) => setNewBudgetValue(e.target.value)}
                      className="w-20 px-1 py-0.5 border border-gray-300 rounded text-right"
                      min="1"
                    />
                  ) : (
                    `${s.weeklyBudget.toFixed(0)} TOWNS`
                  )}
                </td>
                <td className="px-3 py-2 text-right">{s.lockedAllowance.toFixed(2)} TOWNS</td>
                <td className="px-3 py-2 text-right">{(s.cashbackEarnings - s.cashbackClaimed).toFixed(2)} TOWNS</td>
                <td className="px-3 py-2 text-right">{s.totalTipped.toFixed(2)} TOWNS</td>
                <td className="px-3 py-2 text-right">{s.daysUntilReset}d</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {editingAddress === s.address ? (
                      <>
                        <button
                          onClick={() => handleUpdateBudget(s.address)}
                          disabled={updatingAddress === s.address}
                          className="px-2 py-1 text-xs bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
                        >
                          {updatingAddress === s.address ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingAddress(null)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingAddress(s.address); setNewBudgetValue(String(s.weeklyBudget.toFixed(0))); }}
                          className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                        >
                          Update Budget
                        </button>
                        <button
                          onClick={() => handleAllocateNow(s.address)}
                          disabled={allocatingAddress === s.address}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50"
                        >
                          {allocatingAddress === s.address ? 'Allocating...' : 'Allocate Now'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
                            <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              {c.contributorType}
                            </span>
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
  const [contributorStats, setContributorStats] = useState<ContributorStats[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const fetchContributors = useCallback(async () => {
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
  }, [adminAddress]);

  const fetchContributorStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch('/api/admin/contributors/stats');
      const data = await response.json();
      if (data.success) {
        setContributorStats(data.data);
      } else {
        console.error('Failed to fetch contributor stats:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch contributor stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchContributors();
    fetchContributorStats();
  }, [fetchContributors, fetchContributorStats]);

  return (
    <div>
      <h2 className="font-adonis text-3xl mb-6">On-Chain Contributor Management</h2>
      <ContributorPoolWidget />
      <AddContributorForm onMintSuccess={fetchContributors} />
      <WeeklyAllowanceManager onStatsRefreshed={fetchContributorStats} />
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-adonis text-2xl">📊 Contributor Stats (On-Chain)</h3>
          <button
            onClick={fetchContributorStats}
            disabled={isLoadingStats}
            className="py-1 px-3 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoadingStats ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {isLoadingStats ? (
          <p className="text-center text-gray-500">Loading stats...</p>
        ) : (
          <ContributorStatsTable stats={contributorStats} onBudgetUpdated={fetchContributorStats} />
        )}
      </div>
      {isLoading ? (
        <p className="text-center mt-8">Loading contributors...</p>
      ) : (
        <ContributorList contributors={contributors} onRevokeSuccess={fetchContributors} />
      )}
    </div>
  );
}
