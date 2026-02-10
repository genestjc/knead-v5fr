import { useState, useEffect } from 'react';
import type { SimpleChatPermissions } from '@/types/chat';

export function useChatPermissions(userAddress: string | null) {
  const [permissions, setPermissions] = useState<SimpleChatPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPermissions() {
      if (!userAddress) {
        setPermissions(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/chat/permissions?userAddress=${userAddress}`);
        const data = await response.json();
        
        if (data.success && data.data) {
          setPermissions(data.data);
        } else {
          setError(data.error || 'Failed to fetch permissions');
        }
      } catch (err) {
        console.error('Error fetching permissions:', err);
        setError('Failed to fetch permissions');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
    
    // Poll every 30 seconds to keep permissions fresh (for live event changes)
    const interval = setInterval(fetchPermissions, 30000);
    
    return () => clearInterval(interval);
  }, [userAddress]);

  return { permissions, isLoading, error };
}
