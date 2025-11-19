'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { EventsManager } from '@/components/admin/EventsManager';
import { ContributorManager } from '@/components/admin/ContributorManager';
import { ModerationPanel } from '@/components/admin/ModerationPanel';
import { TreasuryDashboard } from '@/components/admin/TreasuryDashboard';
import type { ChatUser } from '@/types/chat';

// Master admin address
const MASTER_ADMIN_ADDRESS = '0xf27dafdd875759c4f21ddcd4b8a68e86e8e6206e';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'events' | 'contributors' | 'moderation' | 'treasury'>('events');
  const [realUser, setRealUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const account = useActiveAccount();

  // Fetch user to verify admin access
  useEffect(() => {
    async function fetchUser() {
      if (!account?.address) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/chat/get-or-create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: account.address,
          }),
        });

        const data = await response.json();
        
        if (data.success && data.user) {
          setRealUser(data.user);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [account?.address]);

  // Check if user is master admin
  const isMasterAdmin = account?.address?.toLowerCase() === MASTER_ADMIN_ADDRESS.toLowerCase();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not connected
  if (!account?.address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-5xl mb-6">Admin Dashboard</h1>
          <p className="font-georgia-pro text-lg mb-8 text-gray-600">
            Connect your wallet to access the admin panel
          </p>
          <ThirdWebConnectButton />
        </div>
      </div>
    );
  }

  // Access denied
  if (!isMasterAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Access Denied</h1>
          <p className="font-georgia-pro text-lg mb-6 text-gray-600">
            This dashboard is restricted to master administrators only.
          </p>
          <p className="font-georgia-pro text-sm text-gray-500">
            Connected address: {account.address.slice(0, 6)}...{account.address.slice(-4)}
          </p>
          <a 
            href="/chat-test" 
            className="inline-block mt-6 px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
          >
            Go to Chat
          </a>
        </div>
      </div>
    );
  }

  // Main admin dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-adonis text-3xl mb-1">Admin Dashboard</h1>
              <p className="font-georgia-pro text-sm text-gray-600">
                Logged in as: {realUser?.alias || realUser?.displayName || `${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
                {' '}<span className="text-xs">👑 Master Admin</span>
              </p>
            </div>
            <a
              href="/chat-test"
              className="px-6 py-2 bg-gray-100 text-black rounded-full font-georgia-pro hover:bg-gray-200 transition"
            >
              ← Back to Chat
            </a>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('events')}
              className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${
                activeTab === 'events'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🎙️ Events & Live Interviews
            </button>
            <button
              onClick={() => setActiveTab('contributors')}
              className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${
                activeTab === 'contributors'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ✍️ Contributors
            </button>
            <button
              onClick={() => setActiveTab('moderation')}
              className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${
                activeTab === 'moderation'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🛡️ Moderation
            </button>
            <button
              onClick={() => setActiveTab('treasury')}
              className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${
                activeTab === 'treasury'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💰 Treasury
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'events' && <EventsManager adminAddress={account.address} />}
        {activeTab === 'contributors' && <ContributorManager adminAddress={account.address} />}
        {activeTab === 'moderation' && realUser && <ModerationPanel adminId={realUser.id} />}
        {activeTab === 'treasury' && <TreasuryDashboard adminAddress={account.address} />}
      </main>
    </div>
  );
}
