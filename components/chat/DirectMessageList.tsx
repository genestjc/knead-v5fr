'use client';

/**
 * Direct Message List Component
 * 
 * Displays list of DM conversations in sidebar
 * - Shows other user's info from chat_users table
 * - Click to open DM
 * - New message button (contributor-only)
 */

import { useEffect, useState } from 'react';
import { useUserDms, useCreateDm, useDm, useMemberList, useTimeline, useMyMember } from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { formatAddressForDisplay } from '@/lib/utils/transformers';
import { Search, X } from 'lucide-react';

interface Contributor {
  id: string;
  address: string;
  displayName: string;
  avatar: string | null;
}

interface DirectMessageListProps {
  userId: string;
  onSelectDm: (dmId: string, townsDmId: string, otherUserName?: string, otherUserAvatar?: string) => void;
  selectedDmId?: string;
}

export function DirectMessageList({ 
  userId, 
  onSelectDm, 
  selectedDmId 
}: DirectMessageListProps) {
  const { isContributor, loading: permissionsLoading } = useContributorPermissions(userId);
  const { streamIds, isLoading, error: dmsError } = useUserDms();
  const { createDM, isPending: isCreatingDm } = useCreateDm();
  
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [newDmAddress, setNewDmAddress] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loadingContributors, setLoadingContributors] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreateDm = async () => {
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
      const result = await createDM(newDmAddress.trim());
      
      if (result?.streamId) {
        onSelectDm(result.streamId, result.streamId);
        setShowNewDmModal(false);
        setNewDmAddress('');
      }
    } catch (error: any) {
      console.error('Failed to create DM:', error);
      
      const errorMessage = error.message || String(error);
      
      if (errorMessage.includes('already exists')) {
        setCreateError('✅ DM already exists! Close this modal to see it in the list.');
        setTimeout(() => {
          setShowNewDmModal(false);
          setNewDmAddress('');
          setCreateError(null);
        }, 2000);
        return;
      }
      
      if (errorMessage.includes('BAD_PREV_MINIBLOCK_HASH') || 
          errorMessage.includes('miniblock') ||
          errorMessage.includes('timeout') || 
          errorMessage.includes('deadline') || 
          errorMessage.includes('context deadline exceeded')) {
        setCreateError('⏱️ Network syncing... Refreshing in 5 seconds...');
        setTimeout(() => { window.location.reload(); }, 5000);
        return;
      }
      
      setCreateError(errorMessage || 'Failed to create DM. Please try again.');
    }
  };

  const closeModal = () => {
    setShowNewDmModal(false);
    setNewDmAddress('');
    setCreateError(null);
    setSearchQuery('');
  };

  useEffect(() => {
    if (showNewDmModal && contributors.length === 0) {
      const fetchContributors = async () => {
        setLoadingContributors(true);
        try {
          const response = await fetch('/api/admin/contributors');
          const data = await response.json();
          
          if (data.success) {
            const filteredContributors = (data.data || []).filter(
              (c: Contributor) => c.address.toLowerCase() !== userId.toLowerCase()
            );
            setContributors(filteredContributors);
          } else {
            console.error('❌ API returned error:', data.error);
          }
        } catch (error) {
          console.error('❌ Failed to fetch contributors:', error);
        } finally {
          setLoadingContributors(false);
        }
      };
      fetchContributors();
    }
  }, [showNewDmModal, contributors.length, userId]);

  const filteredContributors = contributors.filter((c) => {
    const query = searchQuery.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(query) ||
      c.address.toLowerCase().includes(query)
    );
  });

  const selectContributor = (address: string) => {
    setNewDmAddress(address);
    setSearchQuery('');
  };

  const NewDmModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-adonis text-xl">New Direct Message</h3>
            <button
              onClick={closeModal}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contributors..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-georgia-pro text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingContributors ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
          ) : filteredContributors.length > 0 ? (
            <div className="p-2">
              {filteredContributors.map((contributor) => (
                <button
                  key={contributor.id}
                  onClick={() => selectContributor(contributor.address)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                >
                  {contributor.avatar ? (
                    <img
                      src={contributor.avatar}
                      alt={contributor.displayName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                      {contributor.displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-georgia-pro font-medium text-sm text-gray-900 truncate">
                      {contributor.displayName}
                    </p>
                    <p className="font-georgia-pro text-xs text-gray-500 truncate">
                      {contributor.address.slice(0, 8)}...{contributor.address.slice(-6)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-gray-500 font-georgia-pro">
              {searchQuery ? 'No contributors found' : 'No contributors available'}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2 font-georgia-pro">
              Or enter wallet address directly
            </label>
            <input
              type="text"
              value={newDmAddress}
              onChange={(e) => setNewDmAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-georgia-pro text-sm"
            />
          </div>

          {createError && (
            <div className={`mb-4 p-3 border rounded-lg text-sm font-georgia-pro ${
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
              {isCreatingDm ? 'Creating...' : 'Create DM'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (permissionsLoading || isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500 font-georgia-pro">
        Loading conversations...
      </div>
    );
  }

  if (!isContributor) {
    return (
      <div className="p-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-adonis font-medium text-blue-900 mb-2">Direct Messages</h3>
          <p className="text-sm text-blue-700 font-georgia-pro">
            Direct messaging is available only to Contributors.
          </p>
          <p className="text-xs text-blue-600 mt-2 font-georgia-pro">
            💡 Contributors have full access to DMs and can message each other anytime.
          </p>
        </div>
      </div>
    );
  }

  if (dmsError) {
    return (
      <div className="p-4 text-sm text-red-500 font-georgia-pro">
        {dmsError.message || 'Failed to load conversations'}
      </div>
    );
  }

  if (!streamIds || streamIds.length === 0) {
    return (
      <div className="p-4">
        <button
          onClick={() => setShowNewDmModal(true)}
          className="w-full py-3 px-4 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-georgia-pro font-medium text-sm mb-4"
        >
          + New Message
        </button>
        
        <div className="text-sm text-gray-500 font-georgia-pro">
          <p>No conversations yet.</p>
          <p className="mt-2 text-xs">
            Contributors can start direct messages with each other.
          </p>
        </div>

        {showNewDmModal && <NewDmModal />}
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
        {streamIds.map((streamId) => (
          <DmListItem
            key={streamId}
            streamId={streamId}
            currentUserId={userId}
            onSelect={onSelectDm}
            isSelected={selectedDmId === streamId}
          />
        ))}
      </div>

      {showNewDmModal && <NewDmModal />}
    </div>
  );
}

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
  const VIDEO_CALL_INVITE_PREFIX = '📹 [VIDEO_CALL_INVITE]';
  const [userProfile, setUserProfile] = useState<{ displayName: string; avatar: string | null } | null>(null);
  
  const { data: dm } = useDm(streamId);
  
  // ✅ Use SDK's userId, NOT the passed wallet address
  const { userId: myUserId } = useMyMember(streamId);
  const { data: members } = useMemberList(streamId);
  const { data: timelineEvents } = useTimeline(streamId);
  
  // ✅ Debug logging
  useEffect(() => {
    console.log('🔍 DmListItem Debug:');
    console.log('   streamId:', streamId);
    console.log('   myUserId (from SDK):', myUserId);
    console.log('   currentUserId (wallet):', currentUserId);
    console.log('   members.userIds:', members?.userIds);
  }, [streamId, myUserId, currentUserId, members]);
  
  // ✅ Wait for members to load before rendering
  if (!members?.userIds || members.userIds.length === 0) {
    return null;
  }
  
  // ✅ Find the other user using SDK's userId (NOT wallet address)
  const otherUserId = members.userIds.find(
    (id) => id !== myUserId // Compare against SDK userId
  ) || myUserId; // Fallback to self for self-DMs

  // ✅ Handle self-DM case
  const isSelfDm = members.userIds.length === 1 || otherUserId === myUserId;

  // Check if the last message is an incoming video call invite
  const hasIncomingCall = (() => {
    if (!timelineEvents || timelineEvents.length === 0) return false;
    const lastEvent = timelineEvents[timelineEvents.length - 1];
    const senderId = lastEvent?.sender?.id || '';
    const isFromOtherUser = senderId !== myUserId; // Use SDK userId
    if (!isFromOtherUser) return false;
    if (lastEvent?.content?.kind !== RiverTimelineEvent.ChannelMessage) return false;
    const messageText = (lastEvent.content as any).body || '';
    return messageText.startsWith(VIDEO_CALL_INVITE_PREFIX);
  })();
  
  // Fetch other user's profile from chat_users
  useEffect(() => {
    const fetchProfile = async () => {
      if (!otherUserId) return;
      try {
        const response = await fetch(`/api/chat/user?address=${otherUserId}`);
        const data = await response.json();
        
        if (data.success && data.user) {
          setUserProfile({
            displayName: data.user.alias || formatAddressForDisplay(data.user.address || otherUserId),
            avatar: data.user.avatar,
          });
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      }
    };

    fetchProfile();
  }, [otherUserId]);
  
  // ✅ Show wallet address for anonymous users, handle self-DM
  const displayName = isSelfDm 
    ? userProfile?.displayName || formatAddressForDisplay(myUserId) + ' (You)'
    : userProfile?.displayName || formatAddressForDisplay(otherUserId);
  
  const avatarInitials = displayName.slice(0, 2).toUpperCase();
  
  const convertIpfsToGatewayUrl = (uri: string): string => {
    if (uri && uri.startsWith('ipfs://')) {
      return `https://ipfs.thirdwebcdn.com/ipfs/${uri.replace('ipfs://', '')}`;
    }
    return uri || '';
  };
  
  return (
    <button
      onClick={() => onSelect(streamId, streamId, displayName, userProfile?.avatar || undefined)}
      className={`
        w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors
        ${isSelected ? 'bg-gray-100 border-l-4 border-blue-600' : ''}
        ${hasIncomingCall && !isSelected ? 'bg-green-50 border-l-4 border-green-600' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        {userProfile?.avatar ? (
          <img
            src={convertIpfsToGatewayUrl(userProfile.avatar)}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
            {avatarInitials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="font-adonis text-sm truncate">
            {displayName}
          </div>
          {hasIncomingCall && (
            <div className="text-xs text-green-700 font-medium">
              📹 Incoming video call
            </div>
          )}
        </div>

        <div className="text-xs text-gray-400 font-georgia-pro">
          {dm?.lastMessageAt ? formatTimestamp(dm.lastMessageAt) : ''}
        </div>
      </div>
    </button>
  );
}

function formatTimestamp(timestamp: string | number): string {
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
