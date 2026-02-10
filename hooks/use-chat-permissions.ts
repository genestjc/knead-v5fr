import { useState, useEffect, useRef } from 'react';
import type { SimpleChatPermissions } from '@/types/chat';

export function useChatPermissions(userAddress: string | null) {
  const [permissions, setPermissions] = useState<SimpleChatPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const shouldPollRef = useRef<boolean>(false);

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
          
          // Determine if we should poll based on role
          // Contributors don't need polling since they always have access
          shouldPollRef.current = data.data.role !== 'contributor';
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

    // Initial fetch
    fetchPermissions();
    
    // Set up polling interval (only polls if shouldPollRef is true)
    const interval = setInterval(() => {
      if (shouldPollRef.current) {
        fetchPermissions();
      }
    }, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, [userAddress]);

  return { permissions, isLoading, error };
}
