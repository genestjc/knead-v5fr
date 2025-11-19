'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface TreasuryDashboardProps {
  adminAddress: string;
}

export function TreasuryDashboard({ adminAddress }: TreasuryDashboardProps) {
  const [treasuryData, setTreasuryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/treasury?adminAddress=${adminAddress}`);
      const data = await response.json();

      if (data.success) {
        setTreasuryData(data.data);
      } else {
        setError(data.error || 'Failed to fetch treasury data');
      }
    } catch (err) {
      setError('Error fetching treasury data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClaim = async (claimId: string) => {
    if (!confirm('Approve this withdrawal request?')) return;

    setProcessing(claimId);
    try {
      const response = await fetch('/api/admin/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress,
          claimId,
          action: 'approve',
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Withdrawal approved successfully');
        fetchData();
      } else {
        alert(data.error || 'Failed to approve withdrawal');
      }
    } catch (err) {
      console.error(err);
      alert('Error approving withdrawal');
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    const notes = prompt('Enter rejection reason:');
    if (!notes) return;

    setProcessing(claimId);
    try {
      const response = await fetch('/api/admin/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress,
          claimId,
          action: 'reject',
          notes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Withdrawal rejected');
        fetchData();
      } else {
        alert(data.error || 'Failed to reject withdrawal');
      }
    } catch (err) {
      console.error(err);
      alert('Error rejecting withdrawal');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!treasuryData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="font-georgia-pro text-sm text-red-800">{error || 'No treasury data available'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-adonis text-2xl mb-1">Treasury Dashboard</h2>
        <p className="font-georgia-pro text-sm text-gray-600">Manage $TOWNS token distributions and withdrawals</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-georgia-pro text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Treasury Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="font-georgia-pro text-sm text-gray-600 mb-2">Treasury Balance</p>
          <p className="font-adonis text-3xl">{parseFloat(treasuryData.balance).toFixed(2)} $TOWNS</p>
          <p className="font-georgia-pro text-xs text-gray-500 mt-2 truncate">
            {treasuryData.treasuryAddress}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="font-georgia-pro text-sm text-gray-600 mb-2">Pending Withdrawals</p>
          <p className="font-adonis text-3xl">{treasuryData.totalPendingAmount?.toFixed(2) || 0} $TOWNS</p>
          <p className="font-georgia-pro text-xs text-gray-500 mt-2">
            {treasuryData.pendingClaims?.length || 0} requests
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="font-georgia-pro text-sm text-gray-600 mb-2">Treasury Health</p>
          <p className={`font-adonis text-3xl ${treasuryData.isHealthy ? 'text-green-600' : 'text-red-600'}`}>
            {treasuryData.isHealthy ? 'Healthy' : 'Low'}
          </p>
          <p className="font-georgia-pro text-xs text-gray-500 mt-2">
            {treasuryData.isHealthy ? 'Sufficient funds' : 'Needs funding'}
          </p>
        </div>
      </div>

      {/* Pending Claims */}
      <div>
        <h3 className="font-adonis text-xl mb-4">
          Pending Withdrawal Requests ({treasuryData.pendingClaims?.length || 0})
        </h3>
        {!treasuryData.pendingClaims || treasuryData.pendingClaims.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <p className="font-georgia-pro text-gray-500">No pending withdrawal requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {treasuryData.pendingClaims.map((claim: any) => (
              <div key={claim.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-georgia-pro font-semibold">{claim.user?.displayName || 'Unknown'}</span>
                      <span className="font-adonis text-lg">{claim.amount} $TOWNS</span>
                    </div>
                    <p className="font-georgia-pro text-sm text-gray-600">
                      Requested {format(new Date(claim.requestedAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveClaim(claim.id)}
                      disabled={processing === claim.id}
                      className="px-4 py-2 bg-green-600 text-white rounded font-georgia-pro text-sm hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {processing === claim.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleRejectClaim(claim.id)}
                      disabled={processing === claim.id}
                      className="px-4 py-2 bg-red-600 text-white rounded font-georgia-pro text-sm hover:bg-red-700 transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div>
        <h3 className="font-adonis text-xl mb-4">Recent Transactions</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-georgia-pro text-sm font-semibold">User</th>
                <th className="px-4 py-3 text-left font-georgia-pro text-sm font-semibold">Amount</th>
                <th className="px-4 py-3 text-left font-georgia-pro text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-georgia-pro text-sm font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-georgia-pro text-sm font-semibold">TX Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {!treasuryData.transactionHistory || treasuryData.transactionHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <p className="font-georgia-pro text-gray-500">No transaction history</p>
                  </td>
                </tr>
              ) : (
                treasuryData.transactionHistory.map((tx: any) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 font-georgia-pro text-sm">{tx.userName || 'Unknown'}</td>
                    <td className="px-4 py-3 font-georgia-pro text-sm">{tx.amount} $TOWNS</td>
                    <td className="px-4 py-3 font-georgia-pro text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                        tx.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {tx.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-georgia-pro text-sm text-gray-600">
                      {tx.processedAt ? format(new Date(tx.processedAt), 'MMM d, h:mm a') : '-'}
                    </td>
                    <td className="px-4 py-3 font-georgia-pro text-sm text-gray-500">
                      {tx.txHash ? (
                        <a
                          href={`https://basescan.org/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate block max-w-xs"
                        >
                          {tx.txHash.slice(0, 10)}...
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
