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
import { useUserTownsDms } from '@/lib/towns/dm';

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
  onSelectDm: (dmId: string, townsDmId: string) => void;
  selectedDmId?: string;
}

export function DirectMessageList({ 
  userId, 
  onSelectDm, 
  selectedDmId 
}: DirectMessageListProps) {
  const [dms, setDms] = useState<DmConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDms();
  }, [userId]);

  const fetchDms = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chat/dm/list?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setDms(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load DM conversations');
      console.error('Error fetching DMs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading conversations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (dms.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500">
        <p>No conversations yet.</p>
        <p className="mt-2 text-xs">
          Contributors can start direct messages with each other.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {dms.map((dm) => (
        <button
          key={dm.id}
          onClick={() => onSelectDm(dm.id, dm.towns_dm_id)}
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
