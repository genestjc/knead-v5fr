'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface ContributorManagerProps {
  adminAddress: string;
}

export function ContributorManager({ adminAddress }: ContributorManagerProps) {
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [contributors, setContributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Invite form state
  const [inviteAddress, setInviteAddress] = useState('');
  const [inviteType, setInviteType] = useState<'appointed' | 'invited'>('invited');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [requestsRes, contributorsRes] = await Promise.all([
        fetch(`/api/admin/contributor-requests?adminAddress=${adminAddress}`),
        fetch(`/api/admin/contributors?adminAddress=${adminAddress}`),
      ]);

      const [requestsData, contributorsData] = await Promise.all([
        requestsRes.json(),
        contributorsRes.json(),
      ]);

      if (requestsData.success) setPendingRequests(requestsData.data);
      if (contributorsData.success) setContributors(contributorsData.data);
    } catch (err) {
      setError('Error fetching data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string, contributorType: string) => {
    try {
      const response = await fetch(`/api/admin/contributor-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress,
          action: 'approve',
          contributorType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to approve request');
      }
    } catch (err) {
      console.error(err);
      alert('Error approving request');
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/admin/contributor-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress,
          action: 'deny',
        }),
      });

      const data = await response.json();

      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to deny request');
      }
    } catch (err) {
      console.error(err);
      alert('Error denying request');
    }
  };

  const handleInviteContributor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteAddress) return;

    setInviting(true);
    try {
      const response = await fetch('/api/admin/contributors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress,
          contributorAddress: inviteAddress,
          contributorType: inviteType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setInviteAddress('');
        fetchData();
      } else {
        alert(data.error || 'Failed to invite contributor');
      }
    } catch (err) {
      console.error(err);
      alert('Error inviting contributor');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveContributor = async (contributorId: string) => {
    if (!confirm('Remove contributor status from this user?')) return;

    try {
      const response = await fetch(`/api/admin/contributors/${contributorId}?adminAddress=${adminAddress}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to remove contributor');
      }
    } catch (err) {
      console.error(err);
      alert('Error removing contributor');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-adonis text-2xl mb-1">Contributor Management</h2>
        <p className="font-georgia-pro text-sm text-gray-600">Manage contributor applications and invitations</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-georgia-pro text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Pending Requests */}
      <div>
        <h3 className="font-adonis text-xl mb-4">Pending Requests ({pendingRequests.length})</h3>
        {pendingRequests.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <p className="font-georgia-pro text-gray-500">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div key={request.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-georgia-pro font-semibold">{request.user.displayName}</h4>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {request.user.address.slice(0, 6)}...{request.user.address.slice(-4)}
                      </span>
                    </div>
                    <p className="font-georgia-pro text-sm text-gray-600 mb-2">{request.reasoning}</p>
                    <p className="font-georgia-pro text-xs text-gray-400">
                      Requested {format(new Date(request.requestedAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleApproveRequest(request.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="px-3 py-2 bg-green-600 text-white rounded font-georgia-pro text-sm hover:bg-green-700 cursor-pointer"
                    >
                      <option value="">Approve As...</option>
                      <option value="appointed">Appointed</option>
                      <option value="invited">Invited</option>
                      <option value="earned">Earned</option>
                    </select>
                    <button
                      onClick={() => handleDenyRequest(request.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded font-georgia-pro text-sm hover:bg-red-700 transition"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite New Contributor */}
      <div>
        <h3 className="font-adonis text-xl mb-4">Invite New Contributor</h3>
        <form onSubmit={handleInviteContributor} className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block font-georgia-pro text-sm mb-2">Wallet Address</label>
              <input
                type="text"
                value={inviteAddress}
                onChange={(e) => setInviteAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                required
              />
            </div>
            <div>
              <label className="block font-georgia-pro text-sm mb-2">Contributor Type</label>
              <select
                value={inviteType}
                onChange={(e) => setInviteType(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
              >
                <option value="invited">Invited</option>
                <option value="appointed">Appointed</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="mt-4 px-6 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition disabled:opacity-50"
          >
            {inviting ? 'Inviting...' : 'Send Invitation'}
          </button>
        </form>
      </div>

      {/* Current Contributors */}
      <div>
        <h3 className="font-adonis text-xl mb-4">Current Contributors ({contributors.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contributors.map((contributor) => (
            <div key={contributor.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center text-white font-semibold text-lg">
                  {contributor.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-georgia-pro font-semibold truncate">{contributor.displayName}</h4>
                  <p className="font-georgia-pro text-xs text-gray-500 truncate">
                    {contributor.address.slice(0, 6)}...{contributor.address.slice(-4)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                      {contributor.role.toUpperCase()}
                    </span>
                    {contributor.contributorType && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                        {contributor.contributorType}
                      </span>
                    )}
                  </div>
                </div>
                {contributor.role === 'contributor' && (
                  <button
                    onClick={() => handleRemoveContributor(contributor.id)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded font-georgia-pro text-xs hover:bg-red-200 transition"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
