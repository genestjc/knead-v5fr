'use client';

import { useEffect, useState } from 'react';
import { useUserDms, useCreateDm, useDm, useMemberList } from '@towns-protocol/react-sdk';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { formatAddressForDisplay } from '@/lib/utils/transformers';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';

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
  const { isContributor } = useContributorPermissions(userId);
  const { streamIds, isLoading } = useUserDms();
  const { createDM, isPending: isCreatingDm } = useCreateDm();
  
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [newDmAddress, setNewDmAddress] = useState('');
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loadingContributors, setLoadingContributors] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all contributors on modal open
  useEffect(() => {
    if (showNewDmModal && contributors.length === 0) {
      const fetchContributors = async () => {
        setLoadingContributors(true);
        try {
          console.log('🔍 Fetching contributors from blockchain...');
          const response = await fetch('/api/contributors/all');
          const data = await response.json();
          
          if (data.success) {
            // Filter out current user
            const filtered = data.contributors.filter(
              (c: Contributor) => c.address.toLowerCase() !== userId.toLowerCase()
            );
            console.log('✅ Loaded', filtered.length, 'contributors');
            setContributors(filtered);
          } else {
            console.error('❌ Failed to load contributors:', data.error);
            toast.error('Failed to load contributors');
          }
        } catch (error) {
          console.error('❌ Error loading contributors:', error);
          toast.error('Failed to load contributors');
        } finally {
          setLoadingContributors(false);
        }
      };
      fetchContributors();
    }
  }, [showNewDmModal, contributors.length, userId]);

  const handleCreateDm = async () => {
    if (!newDmAddress.trim()) {
      toast.error('Please select a contributor or enter an address');
      return;
    }
    
    try {
      console.log('🔍 Creating DM with:', newDmAddress);
      const result = await createDM(newDmAddress.trim().toLowerCase());
      
      if (result?.streamId) {
        console.log('✅ DM created:', result.streamId);
        onSelectDm(result.streamId, result.streamId);
        setShowNewDmModal(false);
        setNewDmAddress('');
        setSearchQuery('');
        toast.success('DM opened!');
      }
    } catch (error: any) {
      console.error('❌ Failed to create DM:', error);
      
      if (error.message?.includes('already exists')) {
        toast.info('DM already exists - refreshing...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error('Failed to create DM. Please try again.');
      }
    }
  };

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

  const convertIpfsToGatewayUrl = (uri: string): string => {
    if (uri && uri.startsWith('ipfs://')) {
      return `https://ipfs.thirdwebcdn.com/ipfs/${uri.replace('ipfs://', '')}`;
    }
    return uri || '';
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

      {/* New DM Modal */}
      {showNewDmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
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
              
              {/* Search Box */}
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

            {/* Contributors List */}
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
                  {searchQuery ? 'No contributors found' : 'No contributors available'}
                </div>
              )}
            </div>

            {/* Footer - Manual Entry */}
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

function DmListItem({ streamId, currentUserId, onSelect, isSelected }: any) {
  const [profile, setProfile] = useState<any>(null);
  const { data: dm } = useDm(streamId);
  const { data: members } = useMemberList(streamId);
  
  const otherUserId = members?.userIds?.find(id => id.toLowerCase() !== currentUserId.toLowerCase()) || '';
  
  useEffect(() => {
    if (!otherUserId) return;
    fetch(`/api/chat/user?address=${otherUserId}`)
      .then(r => r.json())
      .then(d => d.success && setProfile(d.user));
  }, [otherUserId]);
  
  const name = profile?.alias || formatAddressForDisplay(otherUserId);
  
  const convertIpfsToGatewayUrl = (uri: string): string => {
    if (uri && uri.startsWith('ipfs://')) {
      return `https://ipfs.thirdwebcdn.com/ipfs/${uri.replace('ipfs://', '')}`;
    }
    return uri || '';
  };
  
  return (
    <button
      onClick={() => onSelect(streamId, streamId, name, profile?.avatar)}
      className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors font-georgia-pro ${isSelected ? 'bg-gray-100 border-l-4 border-blue-600' : ''}`}
    >
      <div className="flex items-center gap-3">
        {profile?.avatar ? (
          <img
            src={convertIpfsToGatewayUrl(profile.avatar)}
            alt={name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 font-georgia-pro text-sm">{name}</div>
      </div>
    </button>
  );
}
