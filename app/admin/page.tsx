'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { EventsManager } from '@/components/admin/EventsManager';
import { ContributorManager } from '@/components/admin/ContributorManager';
import { ModerationPanel } from '@/components/admin/ModerationPanel';
import { TreasuryDashboard } from '@/components/admin/TreasuryDashboard';

const MASTER_ADMIN_ADDRESS = '0xf27dafdd875759c4f21ddcd4b8a68e86e8e6206e';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'events' | 'contributors' | 'moderation' | 'treasury'>('events');
  const account = useActiveAccount();

  const isMasterAdmin = account?.address?.toLowerCase() === MASTER_ADMIN_ADDRESS.toLowerCase();

  if (!account?.address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-5xl mb-6">Admin Dashboard</h1>
          <p className="font-georgia-pro text-lg mb-8 text-gray-600">Connect your wallet to access the admin panel</p>
          <ThirdWebConnectButton />
        </div>
      </div>
    );
  }

  if (!isMasterAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Access Denied</h1>
          <p className="font-georgia-pro text-lg mb-6 text-gray-600">This dashboard is restricted to master administrators only.</p>
          <p className="font-georgia-pro text-sm text-gray-500">Connected address: {account.address.slice(0, 6)}...{account.address.slice(-4)}</p>
          <a href="/chat-test" className="inline-block mt-6 px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition">Go to Chat</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-adonis text-3xl mb-1">Admin Dashboard</h1>
                    <p className="font-georgia-pro text-sm text-gray-600">
                        Logged in as: {account.address.slice(0, 6)}...{account.address.slice(-4)}
                        {' '}<span className="text-xs">👑 Master Admin</span>
                    </p>
                </div>
                <a href="/chat-test" className="px-6 py-2 bg-gray-100 text-black rounded-full font-georgia-pro hover:bg-gray-200 transition">← Back to Chat</a>
            </div>
        </div>
      </header>
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button onClick={() => setActiveTab('events')} className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${activeTab === 'events' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>🎙️ Events & Live Interviews</button>
            <button onClick={() => setActiveTab('contributors')} className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${activeTab === 'contributors' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>✍️ Contributors</button>
            <button onClick={() => setActiveTab('moderation')} className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${activeTab === 'moderation' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>🛡️ Moderation</button>
            <button onClick={() => setActiveTab('treasury')} className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${activeTab === 'treasury' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>💰 Treasury</button>
          </nav>
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* **THE FIX IS HERE** We ensure account.address exists before rendering these components */}
        {account.address && (
          <>
            {activeTab === 'events' && <EventsManager adminAddress={account.address} />}
            {activeTab === 'contributors' && <ContributorManager adminAddress={account.address} />}
            {activeTab === 'moderation' && realUser && <ModerationPanel adminId={realUser.id} />}
            {activeTab === 'treasury' && <TreasuryDashboard adminAddress={account.address} />}
          </>
        )}
      </main>
    </div>
  );
}
