"use client";

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useMembership } from '@/components/membership-provider';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { KNEAD_CHANNELS } from '@/lib/chat/config';
import { canViewChannel } from '@/lib/chat/permissions';
import type { ChatUser } from '@/types/chat';

export default function ChatTestPage() {
  const [selectedChannel, setSelectedChannel] = useState('main');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const account = useActiveAccount();
  const { membershipType } = useMembership();

  const mockUser: ChatUser = {
  id: account?.address || '', // ← Added missing id field
  address: account?.address || '',
  displayName: account?.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : '',
  role: 'viewer',
  membershipTier: (membershipType || 'freemium') as 'freemium' | 'premium' | 'contributor',
  contributorType: undefined,
  townsEarned: 0,
  isBanned: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// 🔍 DEBUG LOGS - Check what's happening
console.log('=== CHAT TEST DEBUG ===');
console.log('Account Address:', account?.address);
console.log('Membership Type from Provider:', membershipType);
console.log('Mock User:', mockUser);

const viewAccess = canViewChannel(mockUser, selectedChannel, 0);
console.log('View Access Result:', viewAccess);

const currentChannel = KNEAD_CHANNELS.find(ch => ch.id === selectedChannel);
  if (!account?.address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-5xl mb-6">Knead Chat</h1>
          <p className="font-georgia-pro text-lg mb-8 text-gray-600">
            Connect your wallet to access the community chat
          </p>
          <ThirdWebConnectButton />
        </div>
      </div>
    );
  }

  if (!viewAccess.canView) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Access Restricted</h1>
          <p className="font-georgia-pro text-lg mb-6 text-gray-600">{viewAccess.reason}</p>
          <a 
            href="/join" 
            className="inline-block px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
          >
            Upgrade to Premium
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <header className="border-b border-gray-200 p-4 flex items-center justify-between bg-white">
        <h1 className="font-adonis text-3xl">Knead</h1>
        <div className="flex items-center space-x-4">
          <span className="font-georgia-pro text-sm text-gray-600">
            {mockUser.displayName}
          </span>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex flex-col space-y-1.5 p-2 hover:bg-gray-50 rounded transition"
            aria-label="Menu"
          >
            <span className={`w-6 h-0.5 bg-black transition-all ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`w-6 h-0.5 bg-black transition-all ${isMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`w-6 h-0.5 bg-black transition-all ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </header>

      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
          onClick={() => setIsMenuOpen(false)}
        >
          <div 
            className="absolute right-0 top-0 h-full w-80 bg-white shadow-2xl p-8 transform transition-transform"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setIsMenuOpen(false)}
              className="absolute top-6 right-6 text-3xl text-gray-400 hover:text-black transition"
            >
              ×
            </button>
            <nav className="mt-16 space-y-6">
              <button className="font-adonis text-2xl block w-full text-left hover:text-gray-600 transition">
                Settings
              </button>
              <button className="font-adonis text-2xl block w-full text-left hover:text-gray-600 transition">
                Transfer Earnings
              </button>
              <button className="font-adonis text-2xl block w-full text-left hover:text-gray-600 transition">
                View Profile
              </button>
              <div className="border-t border-gray-200 pt-6">
                <a 
                  href="/" 
                  className="font-adonis text-2xl block w-full text-left hover:text-gray-600 transition"
                >
                  Return to Home
                </a>
              </div>
            </nav>
            
            <div className="absolute bottom-8 left-8 right-8 border-t border-gray-200 pt-6">
              <div className="font-georgia-pro text-sm text-gray-500 space-y-2">
                <div className="flex justify-between">
                  <span>Membership:</span>
                  <span className="font-semibold capitalize">{mockUser.membershipTier}</span>
                </div>
                <div className="flex justify-between">
                  <span>$TOWNS Earned:</span>
                  <span className="font-semibold">{mockUser.townsEarned}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-gray-200 flex flex-col bg-gray-50">
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="font-adonis text-sm uppercase tracking-wider text-gray-500 mb-4">Channels</h2>
            <div className="space-y-1">
              {KNEAD_CHANNELS.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition font-georgia-pro flex items-center space-x-3 ${
                    selectedChannel === channel.id
                      ? 'bg-white shadow-sm text-black'
                      : 'text-gray-600 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <span className="text-xl">{channel.icon}</span>
                  <span>{channel.name}</span>
                  {channel.isOpenPeriod && (
                    <span className="ml-auto w-2 h-2 bg-green-500 rounded-full" title="Open Period Active" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 p-6 bg-white">
            <h2 className="font-adonis text-sm uppercase tracking-wider text-gray-500 mb-4">Direct Messages</h2>
            <button className="w-full text-left px-4 py-3 rounded-xl font-georgia-pro text-gray-600 hover:bg-gray-50 transition flex items-center space-x-3">
              <span className="text-xl">✉️</span>
              <span>Messages</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-white">
          <div className="border-b border-gray-200 p-6 bg-white">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-2xl">{currentChannel?.icon}</span>
              <h2 className="font-adonis text-2xl">{currentChannel?.name}</h2>
              {currentChannel?.isOpenPeriod && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-georgia-pro font-semibold">
                  OPEN PERIOD
                </span>
              )}
            </div>
            <p className="font-georgia-pro text-sm text-gray-500 ml-11">
              {currentChannel?.description}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="font-adonis text-2xl mb-2">Chat Interface Coming Soon</h3>
                <p className="font-georgia-pro text-gray-500">
                  Towns Protocol integration in progress. Message functionality will be available soon.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-2 bg-white border-t border-gray-100">
            <p className="font-georgia-pro text-xs text-gray-400 italic h-4">
            </p>
          </div>

          <div className="p-6 bg-white border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <input
                type="text"
                placeholder="Type a message..."
                className="flex-1 px-6 py-3 border border-gray-300 rounded-full font-georgia-pro focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                disabled
              />
              <button
                className="px-8 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled
              >
                Send
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
