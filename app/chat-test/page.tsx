"use client";

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useMembership } from '@/components/membership-provider';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { KNEAD_CHANNELS } from '@/lib/chat/config';
import { canViewChat } from '@/lib/chat/permissions';
import type { ChatUser } from '@/types/chat';

export default function ChatTestPage() {
  const [selectedChannel, setSelectedChannel] = useState('main');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const account = useActiveAccount();
  const { membershipType } = useMembership();

  const mockUser: ChatUser = {
    address: account?.address || '',
    displayName: account?.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : '',
    role: 'viewer',
    membershipTier: (membershipType || 'freemium') as 'freemium' | 'premium' | 'contributor',
    townsEarned: 0,
    isBanned: false,
  };

  const viewAccess = canViewChat(mockUser, 0);
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
    <div className

