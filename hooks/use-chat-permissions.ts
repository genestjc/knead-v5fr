import { useState, useEffect, useRef } from 'react';
import type { SimpleChatPermissions } from '@/types/chat';

export function useChatPermissions(userAddress: string | null) {
  const [permissions, setPermissions] = useState<SimpleChatPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
          
          // Set up polling only for participants and freemium users
          // Contributors don't need polling since they always have access
          if (data.data.role !== 'contributor' && !pollingIntervalRef.current) {
            pollingIntervalRef.current = setInterval(fetchPermissions, 30000);
          } else if (data.data.role === 'contributor' && pollingIntervalRef.current) {
            // Stop polling if user is a contributor
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
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
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [userAddress]);

  return { permissions, isLoading, error };
}
