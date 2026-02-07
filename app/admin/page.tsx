'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { EventsManager } from '@/components/admin/EventsManager';
import { ContributorManager } from '@/components/admin/ContributorManager';

export default function AdminPage() {
  const account = useActiveAccount();
  const [activeTab, setActiveTab] = useState<'events' | 'contributors'>('events');

  const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET || '';

  // ✅ Debug logging
  if (typeof window !== 'undefined') {
    console.log('🔍 Admin Check:', {
      connectedWallet: account?.address,
      connectedLower: account?.address?.toLowerCase(),
      expectedWallet: MASTER_ADMIN_ADDRESS,
      expectedLower: MASTER_ADMIN_ADDRESS.toLowerCase(),
      envVarExists: !!MASTER_ADMIN_ADDRESS,
      match: account?.address?.toLowerCase() === MASTER_ADMIN_ADDRESS.toLowerCase(),
    });
  }

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
          <h1 className="font-adonis text-4xl mb-4">🚫 Unauthorized</h1>
          <p className="font-georgia-pro text-lg text-gray-600 mb-6">
            You do not have permission to access this page.
          </p>
          
          {/* ✅ Debug Panel */}
          <div className="mt-8 p-6 bg-gray-50 rounded-lg text-left">
            <p className="font-adonis text-sm font-bold mb-4 text-center">🔍 Debug Information</p>
            
            <div className="space-y-3 text-xs font-mono">
              <div>
                <p className="text-gray-500 mb-1">Your Connected Wallet:</p>
                <p className="bg-white p-2 rounded border border-gray-200 break-all text-blue-600">
                  {account.address}
                </p>
              </div>
              
              <div>
                <p className="text-gray-500 mb-1">Expected Admin Wallet:</p>
                <p className={`bg-white p-2 rounded border break-all ${
                  MASTER_ADMIN_ADDRESS 
                    ? 'border-green-200 text-green-600' 
                    : 'border-red-200 text-red-600'
                }`}>
                  {MASTER_ADMIN_ADDRESS || '❌ ENV VAR NOT SET'}
                </p>
              </div>
              
              <div>
                <p className="text-gray-500 mb-1">Lowercase Comparison:</p>
                <div className="bg-white p-2 rounded border border-gray-200 space-y-1">
                  <p className="text-blue-600">Yours: {account.address.toLowerCase()}</p>
                  <p className="text-green-600">Expected: {MASTER_ADMIN_ADDRESS.toLowerCase() || 'N/A'}</p>
                </div>
              </div>
              
              <div className={`p-3 rounded font-bold text-center ${
                account.address.toLowerCase() === MASTER_ADMIN_ADDRESS.toLowerCase()
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {account.address.toLowerCase() === MASTER_ADMIN_ADDRESS.toLowerCase()
                  ? '✅ Addresses Match - Should Work!'
                  : '❌ Addresses Don\'t Match'}
              </div>
              
              {!MASTER_ADMIN_ADDRESS && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-4">
                  <p className="text-yellow-800 font-sans text-xs">
                    <strong>Issue:</strong> NEXT_PUBLIC_MASTER_ADMIN_WALLET environment variable is not set in Vercel.
                    <br/><br/>
                    <strong>Fix:</strong> Add it in Vercel Dashboard → Settings → Environment Variables, then redeploy.
                  </p>
                </div>
              )}
            </div>
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
