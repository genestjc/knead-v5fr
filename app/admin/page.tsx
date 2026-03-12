'use client';

import { useState } from 'react';
import { useActiveAccount, ConnectButton } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { EventsManager } from '@/components/admin/EventsManager';
import { ContributorManager } from '@/components/admin/ContributorManager';
import { UserManager } from '@/components/admin/UserManager';
import { MonthlyMintManager } from '@/components/admin/MonthlyMintManager';
import { MailingListManager } from '@/components/admin/MailingListManager';

import { AnnouncementsManager } from '@/components/admin/AnnouncementsManager';

// ✅ Prevents static generation
export const dynamic = 'force-dynamic';

let cachedClient: ReturnType<typeof createThirdwebClient> | null = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
    });
  }
  return cachedClient;
}

export default function AdminPage() {
  const account = useActiveAccount();
  const [activeTab, setActiveTab] = useState<'events' | 'contributors' | 'users' | 'mint' | 'events-mail' | 'contributors-mail' | 'announcements'>('events');

  const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET || '';
  const client = getClient();

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="font-adonis text-4xl mb-4">Admin Access Required</h1>
          <p className="font-georgia-pro text-lg text-gray-600 mb-6">
            Connect your admin wallet to continue
          </p>
          <ConnectButton 
            client={client}
            theme="light"
          />
        </div>
      </div>
    );
  }

  if (account.address.toLowerCase() !== MASTER_ADMIN_ADDRESS.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">🚫 Unauthorized</h1>
          <p className="font-georgia-pro text-lg text-gray-600 mb-4">
            Connected wallet does not have admin access.
          </p>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm font-mono">
            <p className="text-gray-500 mb-2">Connected as:</p>
            <p className="text-red-600 break-all">{account.address}</p>
          </div>
          
          <div className="mt-6">
            <ConnectButton 
              client={client}
              theme="light"
            />
          </div>
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
            <div className="flex gap-4 items-center">
              <ConnectButton 
                client={client}
                theme="light"
              />
              <a href="/chat" className="px-6 py-2 bg-gray-100 text-black rounded-full font-georgia-pro hover:bg-gray-200 transition">
                ← Back to Chat
              </a>
            </div>
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
            
            <button 
              onClick={() => setActiveTab('users')} 
              className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${
                activeTab === 'users' 
                  ? 'border-black text-black' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              👥 Users & Moderation
            </button>

            <button 
              onClick={() => setActiveTab('mint')} 
              className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${
                activeTab === 'mint' 
                  ? 'border-black text-black' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🎫 Monthly Mint
            </button>

            <button 
              onClick={() => setActiveTab('events-mail')} 
              className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${
                activeTab === 'events-mail' 
                  ? 'border-black text-black' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📧 Events List
            </button>

            <button 
              onClick={() => setActiveTab('contributors-mail')} 
              className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${
                activeTab === 'contributors-mail' 
                  ? 'border-black text-black' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📬 Contributors List
            </button>

            <button
              onClick={() => setActiveTab('announcements')}
              className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${
                activeTab === 'announcements'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📢 Announcements
            </button>
          </nav>
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {account.address && (
          <>
            {activeTab === 'events' && <EventsManager adminAddress={account.address} />}
            {activeTab === 'contributors' && <ContributorManager adminAddress={account.address} />}
            {activeTab === 'users' && <UserManager adminAddress={account.address} />}
            {activeTab === 'mint' && <MonthlyMintManager adminAddress={account.address} />}
            {activeTab === 'events-mail' && (
              <MailingListManager adminAddress={account.address} listType="events" />
            )}
            {activeTab === 'contributors-mail' && (
              <MailingListManager adminAddress={account.address} listType="contributors" />
            )}
            {activeTab === 'announcements' && (
              <AnnouncementsManager adminAddress={account.address} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
