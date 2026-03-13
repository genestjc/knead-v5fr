'use client';

import { useEffect, useState } from 'react';
import { useUserDms, useCreateDm, useDm, useMemberList } from '@towns-protocol/react-sdk';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { formatAddressForDisplay } from '@/lib/utils/transformers';
import { X } from 'lucide-react';
import { toast } from 'sonner';

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

  const handleCreateDm = async () => {
    if (!newDmAddress.trim()) {
      toast.error('Please enter a wallet address');
      return;
    }
    
    try {
      const result = await createDM(newDmAddress.trim().toLowerCase());
      
      if (result?.streamId) {
        onSelectDm(result.streamId, result.streamId);
        setShowNewDmModal(false);
        setNewDmAddress('');
        toast.success('DM opened!');
      }
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        toast.info('DM exists - refreshing...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error('Failed to create DM. Please try again.');
      }
    }
  };

  if (isLoading) return <div className="p-4 text-sm text-gray-500">Loading...</div>;
  
  if (!isContributor) {
    return (
      <div className="p-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">Direct messaging is available only to Contributors.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="p-3 border-b">
        <button
          onClick={() => setShowNewDmModal(true)}
          className="w-full py-2 px-4 bg-black text-white rounded-full hover:bg-gray-800"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-adonis text-xl">New Message</h3>
              <button onClick={() => setShowNewDmModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <input
              type="text"
              value={newDmAddress}
              onChange={(e) => setNewDmAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border rounded-lg mb-4"
            />
            
            <button
              onClick={handleCreateDm}
              disabled={isCreatingDm}
              className="w-full py-2 bg-black text-white rounded-full disabled:bg-gray-400"
            >
              {isCreatingDm ? 'Creating...' : 'Create DM'}
            </button>
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
  
  return (
    <button
      onClick={() => onSelect(streamId, streamId, name, profile?.avatar)}
      className={`w-full text-left px-4 py-3 hover:bg-gray-100 ${isSelected ? 'bg-gray-100 border-l-4 border-blue-600' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1">{name}</div>
      </div>
    </button>
  );
}
