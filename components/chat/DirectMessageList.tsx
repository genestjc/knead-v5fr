'use client';

/**
 * Direct Message List Component
 * 
 * Displays list of DM conversations in sidebar
 * - Shows other user's info
 * - Last message preview
 * - Click to open DM
 * - New message button (contributor-only)
 */

import { useEffect, useState } from 'react';
import { useUserDms, useCreateDm } from '@towns-protocol/react-sdk';

interface DmConversation {
  id: string;
  towns_dm_id: string;
  created_at: string;
  last_message_at: string;
  other_user: {
    id: string;
    wallet_address: string;
    role: string;
    display_name: string;
  } | null;
}

interface DirectMessageListProps {
  userId: string;
  onSelectDm: (dmId: string, townsDmId: string, otherUserName?: string) => void;
  selectedDmId?: string;
}

export function DirectMessageList({ 
  userId, 
  onSelectDm, 
  selectedDmId 
}: DirectMessageListProps) {
  // ✅ CORRECT: Use Towns SDK's useUserDms hook
  const { data: townsDms, isLoading, error: dmsError } = useUserDms();
  const { createDm, isPending: isCreatingDm } = useCreateDm();
  
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [newDmAddress, setNewDmAddress] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Transform Towns DM data to match component's expected format
  const dms: DmConversation[] = (townsDms || []).map((dm: any) => ({
    id: dm.id,
    towns_dm_id: dm.id,
    created_at: dm.createdAt || new Date().toISOString(),
    last_message_at: dm.lastMessageAt || dm.createdAt || new Date().toISOString(),
    other_user: {
      id: dm.otherUserId || '',
      wallet_address: dm.otherUserId || '',
      role: 'contributor',
      display_name: dm.otherUserName || 'Unknown',
    },
  }));

  const handleCreateDm = async () => {
    if (!newDmAddress.trim()) {
      setCreateError('Please enter a wallet address');
      return;
    }

    setCreateError(null);
    
    try {
      const result = await createDm({ recipientAddress: newDmAddress.trim() });
      
      if (result?.id) {
        // DM created successfully, select it
        onSelectDm(result.id, result.id);
        setShowNewDmModal(false);
        setNewDmAddress('');
      }
    } catch (error: any) {
      console.error('Failed to create DM:', error);
      setCreateError(error.message || 'Failed to create DM. Please try again.');
    }
  };

  const closeModal = () => {
    setShowNewDmModal(false);
    setNewDmAddress('');
    setCreateError(null);
  };

  // Reusable New DM Modal component
  const NewDmModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="font-adonis text-xl mb-4">New Direct Message</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Wallet Address
          </label>
          <input
            type="text"
            value={newDmAddress}
            onChange={(e) => setNewDmAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {createError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {createError}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={closeModal}
            className="flex-1 py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            disabled={isCreatingDm}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateDm}
            disabled={isCreatingDm}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {isCreatingDm ? 'Creating...' : 'Create DM'}
          </button>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading conversations...
      </div>
    );
  }

  if (dmsError) {
    return (
      <div className="p-4 text-sm text-red-500">
        {dmsError.message || 'Failed to load conversations'}
      </div>
    );
  }

  if (dms.length === 0) {
    return (
      <div className="p-4">
        <button
          onClick={() => setShowNewDmModal(true)}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm mb-4"
        >
          + New Message
        </button>
        
        <div className="text-sm text-gray-500">
          <p>No conversations yet.</p>
          <p className="mt-2 text-xs">
            Contributors can start direct messages with each other.
          </p>
        </div>

        {/* New DM Modal */}
        {showNewDmModal && <NewDmModal />}
      </div>
    );
  }

  return (
    <div>
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={() => setShowNewDmModal(true)}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          + New Message
        </button>
      </div>

      <div className="space-y-1">
        {dms.map((dm) => (
          <button
            key={dm.id}
            onClick={() => onSelectDm(dm.id, dm.towns_dm_id, dm.other_user?.display_name)}
            className={`
              w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors
              ${selectedDmId === dm.id ? 'bg-gray-100 border-l-4 border-blue-600' : ''}
            `}
          >
            <div className="flex items-center gap-3">
              {/* Avatar placeholder */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                {dm.other_user?.display_name.slice(0, 2).toUpperCase() || '??'}
              </div>

              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {dm.other_user?.display_name || 'Unknown User'}
                </div>
                <div className="text-xs text-gray-500">
                  {dm.other_user?.role === 'contributor' && '✓ Contributor'}
                </div>
              </div>

              {/* Timestamp */}
              <div className="text-xs text-gray-400">
                {formatTimestamp(dm.last_message_at)}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* New DM Modal */}
      {showNewDmModal && <NewDmModal />}
    </div>
  );
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
