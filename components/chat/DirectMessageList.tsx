'use client';

/**
 * Direct Message List Component
 * 
 * Displays list of DM conversations in sidebar
 * - Shows other user's info
 * - Last message preview
 * - Click to open DM
 * - New message button (contributor-only)
 * 
 * DM Access: Only Contributors can create and view DMs
 * - Freemium users: No DM access
 * - Participants: No DM access
 * - Contributors: Full DM access
 */

import { useEffect, useState } from 'react';
import { useUserDms, useCreateDm } from '@towns-protocol/react-sdk';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';

interface DirectMessageListProps {
  userId: string;  // Actually the wallet address (kept for compatibility)
  onSelectDm: (dmId: string, townsDmId: string, otherUserName?: string) => void;
  selectedDmId?: string;
}

export function DirectMessageList({ 
  userId, 
  onSelectDm, 
  selectedDmId 
}: DirectMessageListProps) {
  // Check if user is a contributor (required for DM access)
  const { isContributor, loading: permissionsLoading } = useContributorPermissions(userId);
  
  // ✅ FIXED: Use correct return value from useUserDms
  const { streamIds, isLoading, error: dmsError } = useUserDms();
  const { createDM, isPending: isCreatingDm } = useCreateDm();
  
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [newDmAddress, setNewDmAddress] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateDm = async () => {
    // Extra safety check - should never reach here for non-contributors
    if (!isContributor) {
      setCreateError('Only Contributors can send direct messages');
      return;
    }

    if (!newDmAddress.trim()) {
      setCreateError('Please enter a wallet address');
      return;
    }

    setCreateError(null);
    
    try {
      // Call createDM with userId string directly
      const result = await createDM(newDmAddress.trim());
      
      // Use streamId from result
      if (result?.streamId) {
        // DM created successfully, select it
        onSelectDm(result.streamId, result.streamId);
        setShowNewDmModal(false);
        setNewDmAddress('');
      }
    } catch (error: any) {
      console.error('Failed to create DM:', error);
      
      const errorMessage = error.message || String(error);
      
      // ✅ Handle "stream already exists" - DM exists, need to sync and find it
      if (errorMessage.includes('already exists')) {
        setCreateError('✅ DM already exists! Syncing... Refreshing in 3 seconds.');
        
        // Wait for sync, then refresh to show the DM
        setTimeout(() => {
          window.location.reload();
        }, 3000);
        return;
      }
      
      // ✅ Handle BAD_PREV_MINIBLOCK_HASH / sync errors
      if (errorMessage.includes('BAD_PREV_MINIBLOCK_HASH') || 
          errorMessage.includes('miniblock') ||
          errorMessage.includes('timeout') || 
          errorMessage.includes('deadline') || 
          errorMessage.includes('context deadline exceeded')) {
        setCreateError('⏱️ Network syncing... Refreshing in 5 seconds...');
        setTimeout(() => {
          window.location.reload();
        }, 5000);
        return;
      }
      
      // ✅ Generic error
      setCreateError(errorMessage || 'Failed to create DM. Please try again.');
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
          <div className={`mb-4 p-3 border rounded-md text-sm ${
            createError.includes('✅') || createError.includes('⏱️')
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
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

  if (permissionsLoading || isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading conversations...
      </div>
    );
  }

  // ✅ Hide DM UI completely for non-contributors
  if (!isContributor) {
    return (
      <div className="p-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Direct Messages</h3>
          <p className="text-sm text-blue-700">
            Direct messaging is available only to Contributors.
          </p>
          <p className="text-xs text-blue-600 mt-2">
            💡 Contributors have full access to DMs and can message each other anytime.
          </p>
        </div>
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

  if (!streamIds || streamIds.length === 0) {
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

        {/* ✅ Manual refresh button */}
        <button
          onClick={() => window.location.reload()}
          className="w-full mt-3 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          🔄 Refresh DM List
        </button>

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
        {streamIds.map((streamId) => (
          <DmListItem
            key={streamId}
            streamId={streamId}
            onSelect={onSelectDm}
            isSelected={selectedDmId === streamId}
          />
        ))}
      </div>

      {/* New DM Modal */}
      {showNewDmModal && <NewDmModal />}
    </div>
  );
}

// ✅ NEW: Separate component for each DM item
function DmListItem({ 
  streamId, 
  onSelect, 
  isSelected 
}: { 
  streamId: string; 
  onSelect: (dmId: string, townsDmId: string, otherUserName?: string) => void;
  isSelected: boolean;
}) {
  // For now, show streamId as the display name
  // TODO: Use useDm and useMemberList to get proper user info
  const displayName = `DM ${streamId.slice(0, 8)}...`;
  
  return (
    <button
      onClick={() => onSelect(streamId, streamId, displayName)}
      className={`
        w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors
        ${isSelected ? 'bg-gray-100 border-l-4 border-blue-600' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        {/* Avatar placeholder */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
          DM
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {displayName}
          </div>
          <div className="text-xs text-gray-500">
            ✓ Contributor
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-xs text-gray-400">
          now
        </div>
      </div>
    </button>
  );
}
