'use client';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  address: string;
  displayName: string;
  alias: string | null;
  role: string;
  membershipTier: string;
  contributorType: string | null;
  isBanned: boolean;
  createdAt: string;
}

interface UserManagerProps {
  adminAddress: string;
}

export function UserManager({ adminAddress }: UserManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?adminAddress=${adminAddress}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.data);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch (err) {
      setError('Network error loading users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [adminAddress]);

  // Ban/Unban user
  const handleBanUser = async (userAddress: string, shouldBan: boolean) => {
    if (!confirm(`Are you sure you want to ${shouldBan ? 'ban' : 'unban'} this user?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/ban-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          adminAddress,
          ban: shouldBan,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message);
        fetchUsers(); // Refresh list
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Ban/unban failed:', error);
      alert('Failed to update ban status');
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.alias?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        ❌ {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-adonis text-2xl">User Management</h2>
        <button
          onClick={fetchUsers}
          className="px-4 py-2 bg-gray-100 text-black rounded-lg hover:bg-gray-200 transition font-georgia-pro"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 font-georgia-pro">
              Search Users
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by address, name, or alias..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black font-georgia-pro"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 font-georgia-pro">
              Filter by Role
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black font-georgia-pro"
            >
              <option value="all">All Roles</option>
              <option value="viewer">Viewer</option>
              <option value="participant">Participant</option>
              <option value="contributor">Contributor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 font-georgia-pro">Total Users</p>
          <p className="text-2xl font-bold font-adonis">{users.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 font-georgia-pro">Contributors</p>
          <p className="text-2xl font-bold font-adonis">
            {users.filter(u => u.contributorType).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 font-georgia-pro">Premium Members</p>
          <p className="text-2xl font-bold font-adonis">
            {users.filter(u => u.membershipTier === 'premium').length}
          </p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <p className="text-sm text-red-600 font-georgia-pro">Banned Users</p>
          <p className="text-2xl font-bold text-red-600 font-adonis">
            {users.filter(u => u.isBanned).length}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-georgia-pro">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-georgia-pro">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-georgia-pro">
                  Membership
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-georgia-pro">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-georgia-pro">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 font-georgia-pro">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className={user.isBanned ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900 font-georgia-pro">
                          {user.alias || `${user.address.slice(0, 6)}...${user.address.slice(-4)}`}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {user.address.slice(0, 6)}...{user.address.slice(-4)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full font-georgia-pro ${
                        user.role === 'admin' || user.role === 'master-admin'
                          ? 'bg-purple-100 text-purple-800'
                          : user.contributorType
                          ? 'bg-blue-100 text-blue-800'
                          : user.role === 'participant'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.contributorType ? `${user.contributorType} contributor` : user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full font-georgia-pro ${
                        user.membershipTier === 'premium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.membershipTier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isBanned ? (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 font-georgia-pro">
                          🚫 Banned
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 font-georgia-pro">
                          ✅ Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {user.role !== 'admin' && user.role !== 'master-admin' && (
                        <button
                          onClick={() => handleBanUser(user.address, !user.isBanned)}
                          className={`px-3 py-1 rounded-lg font-georgia-pro transition ${
                            user.isBanned
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {user.isBanned ? '✅ Unban' : '🚫 Ban'}
                        </button>
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
