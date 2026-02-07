'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { EventsManager } from '@/components/admin/EventsManager';
import { ContributorManager } from '@/components/admin/ContributorManager';

export default function AdminPage() {
  const account = useActiveAccount();
  // ✅ Only Events and Contributors tabs
  const [activeTab, setActiveTab] = useState<'events' | 'contributors'>('events');

  const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET || '';

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="font-adonis text-4xl mb-4">Admin Access Required</h1>
          <p className="font-georgia-pro text-lg text-gray-600 mb-6">
            Connect your admin wallet to continue
          </p>
        </div>
      </div>
    );
  }

  if (account.address.toLowerCase() !== MASTER_ADMIN_ADDRESS.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Unauthorized</h1>
          <p className="font-georgia-pro text-lg text-gray-600">
            You do not have permission to access this page.
          </p>
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
            <a href="/chat-test" className="px-6 py-2 bg-gray-100 text-black rounded-full font-georgia-pro hover:bg-gray-200 transition">
              ← Back to Chat
            </a>
          </div>
        </div>
      </header>
      
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
            
            {/* Removed: Moderation and Treasury tabs */}
          </nav>
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {account.address && (
          <>
            {activeTab === 'events' && <EventsManager adminAddress={account.address} />}
            {activeTab === 'contributors' && <ContributorManager adminAddress={account.address} />}
          </>
        )}
      </main>
    </div>
  );
}
