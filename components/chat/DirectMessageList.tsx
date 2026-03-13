'use client';

import { useEffect, useState } from 'react';
import { useUserDms, useCreateDm, useMemberList, useMyMember, useMember } from '@towns-protocol/react-sdk';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { useCustomProfile } from '@/hooks/use-custom-profile';
import { formatAddressForDisplay } from '@/lib/utils/transformers';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface DirectMessageListProps {
  userId: string;
  onSelectDm: (dmId: string, townsDmId: string, otherUserName?: string, otherUserAvatar?: string) => void;
  selectedDmId?: string;
}

function convertIpfsToGatewayUrl(uri: string): string {
  if (uri && uri.startsWith('ipfs://')) {
    return `https://ipfs.thirdwebcdn.com/ipfs/${uri.replace('ipfs://', '')}`;
  }
  return uri || '';
}

export function DirectMessageList({ 
  userId, 
  onSelectDm, 
  selectedDmId 
}: DirectMessageListProps) {
  const { isContributor } = useContributorPermissions(userId);
  const { streamIds, isLoading, refetch } = useUserDms();
  const { createDM, isPending: isCreatingDm } = useCreateDm();
  
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [newDmAddress, setNewDmAddress] = useState('');

  const handleCreateDm = async () => {
    if (!newDmAddress.trim()) {
      toast.error('Please enter a wallet address');
      return;
    }
    
    try {
      // ✅ Pass address as-is (no lowercasing)
      const targetAddress = newDmAddress.trim();
      
      // Prevent DMing yourself
      if (targetAddress.toLowerCase() === userId.toLowerCase()) {
        toast.error('You cannot send a message to yourself');
        return;
      }
      
      const result = await createDM(targetAddress);
      
      if (result?.streamId) {
        onSelectDm(result.streamId, result.streamId);
        setShowNewDmModal(false);
        setNewDmAddress('');
        toast.success('DM opened!');
      }
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      
      if (errorMessage.includes('already exists') || errorMessage.includes('stream already exists')) {
        setShowNewDmModal(false);
        setNewDmAddress('');
        
        // ✅ Better approach - wait and refetch instead of full page reload
        toast.info('DM exists, syncing...', { duration: 3000 });
        
        setTimeout(async () => {
          await refetch?.();
          toast.success('DM list refreshed');
        }, 3000);
        
      } else if (errorMessage.includes('BAD_PREV_MINIBLOCK_HASH') || errorMessage.includes('miniblock')) {
        toast.error('Network is syncing. Please wait a moment and try again.');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('deadline')) {
        toast.error('Network timeout. Please try again.');
      } else if (errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
        toast.error('Permission denied. Contact support.');
      } else {
        toast.error('Failed to create DM. Please try again.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500 font-georgia-pro">
        Loading conversations...
      </div>
    );
  }
  
  if (!isContributor) {
    return (
      <div className="p-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-adonis font-medium text-gray-900 mb-2">Direct Messages</h3>
          <p className="text-sm text-gray-700 font-georgia-pro">
            Direct messaging is available only to Contributors.
          </p>
          <p className="text-xs text-gray-600 mt-2 font-georgia-pro">
            💡 Contributors have full access to DMs and can message each other anytime.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={() => setShowNewDmModal(true)}
          className="w-full py-2 px-4 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-georgia-pro text-sm font-medium"
        >
          + New Message
        </button>
      </div>

      <div className="space-y-1">
        {streamIds?.map((streamId) => (
          <DmListItem
            key={streamId}
            streamId={streamId}
            currentUserId={userId}
            onSelect={onSelectDm}
            isSelected={selectedDmId === streamId}
          />
        ))}
      </div>

      {showNewDmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-adonis text-xl">New Direct Message</h3>
              <button
                onClick={() => {
                  setShowNewDmModal(false);
                  setNewDmAddress('');
                }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 font-georgia-pro">
                Enter wallet address
              </label>
              <input
                type="text"
                value={newDmAddress}
                onChange={(e) => setNewDmAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-georgia-pro text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewDmModal(false);
                  setNewDmAddress('');
                }}
                className="flex-1 py-2 px-4 bg-gray-200 text-gray-800 rounded-full hover:bg-gray-300 transition-colors font-georgia-pro text-sm"
                disabled={isCreatingDm}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDm}
                disabled={isCreatingDm || !newDmAddress.trim()}
                className="flex-1 py-2 px-4 bg-black text-white rounded-full hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-georgia-pro text-sm"
              >
                {isCreatingDm ? 'Creating...' : 'Open DM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ✅ Simple component - always calls hooks
function DmListItem({ 
  streamId,
  currentUserId,
  onSelect,
  isSelected 
}: {
  streamId: string;
  currentUserId: string;
  onSelect: (dmId: string, townsDmId: string, otherUserName?: string, otherUserAvatar?: string) => void;
  isSelected: boolean;
}) {
  // ✅ Always call hooks unconditionally
  const { userId: myUserId } = useMyMember(streamId);
  const { data: members } = useMemberList(streamId);
  
  const otherUserId = members?.userIds?.find((userId) => userId !== myUserId) || myUserId;
  
  // Filter out self-DMs
  const isSelfDm = otherUserId?.toLowerCase() === myUserId?.toLowerCase();
  
  const { displayName: sdkDisplayName, username, nft } = useMember({
    streamId,
    userId: otherUserId,
  });
  
  const customProfile = useCustomProfile(otherUserId);
  
  const avatarUrl = customProfile?.avatar || nft?.pfpUrl || null;
  const displayName = customProfile?.alias || sdkDisplayName || username || formatAddressForDisplay(otherUserId);
  
  // Don't render self-DMs
  if (isSelfDm) {
    return null;
  }
  
  return (
    <button
      onClick={() => onSelect(streamId, streamId, displayName, avatarUrl || undefined)}
      className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors font-georgia-pro ${
        isSelected ? 'bg-gray-100 border-l-4 border-blue-600' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={convertIpfsToGatewayUrl(avatarUrl)}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 font-georgia-pro text-sm">{displayName}</div>
      </div>
    </button>
  );
}
