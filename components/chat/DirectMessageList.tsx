'use client';

import { useEffect, useState } from 'react';
import { useUserDms, useCreateDm, useMemberList, useMyMember, useMember } from '@towns-protocol/react-sdk';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { useCustomProfile } from '@/hooks/use-custom-profile';
import { formatAddressForDisplay } from '@/lib/utils/transformers';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { getAddress } from 'viem';

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
  onRefreshReady?: (fn: () => void) => void;
  dmRequestsEnabled?: boolean;
}

function convertIpfsToGatewayUrl(uri: string): string {
  if (uri && uri.startsWith('ipfs://')) {
    return `https://ipfs.thirdwebcdn.com/ipfs/${uri.replace('ipfs://', '')}`;
  }
  return uri || '';
}

export function DirectMessageList({ userId, onSelectDm, selectedDmId, onRefreshReady, dmRequestsEnabled = true }: DirectMessageListProps) {
  const { isContributor } = useContributorPermissions(userId);
  const { streamIds, isLoading, refetch } = useUserDms();
  const { createDM, isPending: isCreatingDm } = useCreateDm();
  
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [newDmAddress, setNewDmAddress] = useState('');
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loadingContributors, setLoadingContributors] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ✅ Step 1: One-time migration on app load
  useEffect(() => {
    const performMigration = async () => {
      const migrationDone = localStorage.getItem('dm_migration_omega_nodes');
      
      if (migrationDone) {
        console.log('✅ DM migration already completed');
        return;
      }
      
      console.log('🔄 Performing one-time DM stream migration...');
      
      try {
        // Clear any cached DM data so SDK re-queries fresh from Stream Registry
        localStorage.removeItem('towns_user_dms_cache');
        localStorage.removeItem('towns_dm_metadata');
        
        // Refetch DM list - will only get streams that exist on active nodes
        await refetch?.();
        
        // Mark migration as done
        localStorage.setItem('dm_migration_omega_nodes', 'true');
        
        console.log('✅ DM streams migrated to active nodes');
        toast.success('DMs synced to active network nodes');
      } catch (error) {
        console.error('Migration error:', error);
        // Even if refetch fails, mark it done to avoid retry loops
        localStorage.setItem('dm_migration_omega_nodes', 'true');
      }
    };
    
    if (isContributor && !isLoading) {
      performMigration();
    }
  }, [isContributor, isLoading, refetch]);

  useEffect(() => {
    if (showNewDmModal && contributors.length === 0) {
      const fetchContributors = async () => {
        setLoadingContributors(true);
        try {
          const response = await fetch('/api/contributors/all');
          const data = await response.json();
          
          if (data.success) {
            const filtered = data.contributors.filter(
              (c: Contributor) => c.address.toLowerCase() !== userId.toLowerCase()
            );
            setContributors(filtered);
          } else {
            console.warn('Contributors API returned error:', data.error);
          }
        } catch (error) {
          console.warn('Failed to load contributors:', error);
        } finally {
          setLoadingContributors(false);
        }
      };
      fetchContributors();
    }
  }, [showNewDmModal, contributors.length, userId]);

  // ✅ Step 2: Handle DM creation with fallback logic
  const handleCreateDm = async () => {
    if (!newDmAddress.trim()) {
      toast.error('Please select a contributor or enter an address');
      return;
    }
    
    try {
      const targetAddress = getAddress(newDmAddress.trim());
      
      if (targetAddress.toLowerCase() === userId.toLowerCase()) {
        toast.error('You cannot send a message to yourself');
        return;
      }
      
      const result = await createDM(targetAddress);
      
      if (result?.streamId) {
        onSelectDm(result.streamId, result.streamId);
        setShowNewDmModal(false);
        setNewDmAddress('');
        setSearchQuery('');
        toast.success('DM opened!');
      }
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      
      // ✅ Old DM exists on dead node - create fresh one
      if (errorMessage.includes('already exists') || errorMessage.includes('stream already exists')) {
        console.log('📋 Old DM detected on stale node, starting fresh...');
        
        // Clear the specific DM from cache
        localStorage.removeItem(`dm_${newDmAddress.trim().toLowerCase()}`);
        
        toast.info('Creating fresh conversation...');
        
        // Wait a moment then retry
        setTimeout(async () => {
          try {
            const freshResult = await createDM(getAddress(newDmAddress.trim()));
            if (freshResult?.streamId) {
              onSelectDm(freshResult.streamId, freshResult.streamId);
              setShowNewDmModal(false);
              setNewDmAddress('');
              setSearchQuery('');
              toast.success('DM opened on active nodes!');
            }
          } catch (retryError) {
            console.error('Fresh DM creation failed:', retryError);
            toast.error('Failed to create DM. Please try again.');
          }
        }, 500);
        return;
      }
      
      // Handle invalid address error
      if (errorMessage.includes('Invalid') || errorMessage.includes('address')) {
        toast.error('Invalid wallet address format');
        return;
      }
      
      if (errorMessage.includes('BAD_PREV_MINIBLOCK_HASH') || errorMessage.includes('miniblock')) {
        toast.error('Network is syncing. Please wait a moment and try again.');
        return;
      }
      
      if (errorMessage.includes('timeout') || errorMessage.includes('deadline')) {
        toast.error('Network timeout. Please try again.');
        return;
      }
      
      if (errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
        toast.error('Permission denied. Contact support.');
        return;
      }
      
      toast.error('Failed to create DM. Please try again.');
    }
  };

  // ✅ Step 4: Manual refresh function for future crashes
  const handleManualRefresh = async () => {
    console.log('🔄 Manually refreshing DM streams...');
    setIsRefreshing(true);
    
    try {
      // Clear cache
      localStorage.removeItem('towns_user_dms_cache');
      
      // Refetch
      await refetch?.();
      
      toast.success('DMs refreshed to active nodes');
    } catch (error) {
      console.error('Refresh failed:', error);
      toast.error('Refresh failed. Try reloading the page.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    onRefreshReady?.(handleManualRefresh);
  }, [onRefreshReady]);

  const filteredContributors = contributors.filter((c) => {
    const query = searchQuery.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(query) ||
      c.address.toLowerCase().includes(query)
    );
  });

  const selectContributor = (address: string) => {
    try {
      setNewDmAddress(getAddress(address));
      setSearchQuery('');
    } catch (error) {
      console.error('Invalid address:', address);
      toast.error('Invalid wallet address');
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
        {dmRequestsEnabled && (
          <button
            onClick={() => setShowNewDmModal(true)}
            className="w-full py-2 px-4 bg-black text-white rounded hover:bg-gray-800 transition-colors font-georgia-pro text-sm font-medium"
          >
            + New Message
          </button>
        )}
      </div>

      {/* ✅ Step 3: DM list with error handling */}
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

      {/* ✅ Modal - fixed closing */}
      {showNewDmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-adonis text-xl">New Direct Message</h3>
                <button
                  onClick={() => {
                    setShowNewDmModal(false);
                    setNewDmAddress('');
                    setSearchQuery('');
                  }}
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
                          src={convertIpfsToGatewayUrl(contributor.avatar)}
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
                  {searchQuery ? 'No contributors found' : contributors.length === 0 ? 'Loading contributors...' : 'No contributors available'}
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

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowNewDmModal(false);
                    setNewDmAddress('');
                    setSearchQuery('');
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
        </div>
      )}
    </div>
  );
}

// ✅ DmListItem with error handling for unreachable streams
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
  const { userId: myUserId } = useMyMember(streamId);
  const { data: members, isError } = useMemberList(streamId);
  
  // ✅ Skip rendering if stream is unreachable (on dead node)
  if (isError) {
    console.warn(`⚠️ Skipping unreachable DM stream: ${streamId}`);
    return null;
  }
  
  // Only proceed if we have data
  if (!myUserId || !members) {
    return null;
  }
  
  const otherUserId = members?.userIds?.find((userId) => userId !== myUserId) || myUserId;
  const isSelfDm = otherUserId?.toLowerCase() === myUserId?.toLowerCase();
  
  const { displayName: sdkDisplayName, username, nft } = useMember({
    streamId,
    userId: otherUserId,
  });
  
  const customProfile = useCustomProfile(otherUserId);
  
  const avatarUrl = customProfile?.avatar || nft?.pfpUrl || null;
  const displayName = customProfile?.alias || sdkDisplayName || username || formatAddressForDisplay(otherUserId);
  
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
