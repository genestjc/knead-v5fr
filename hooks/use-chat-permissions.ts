import { useState, useEffect, useRef, useMemo } from 'react';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import type { SimpleChatPermissions } from '@/types/chat';

export function useChatPermissions(userAddress: string | null) {
  const [permissions, setPermissions] = useState<SimpleChatPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const shouldPollRef = useRef<boolean>(false);

  const fetchPermissions = async () => {
    if (!userAddress) {
      setPermissions(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔐 [Permissions] Fetching for:', userAddress.slice(0, 8) + '...');
      
      const response = await fetch(`/api/chat/permissions?userAddress=${userAddress}`);
      const data = await response.json();
      
      console.log('📬 [Permissions] Response:', data);
      
      if (data.success && data.data) {
        setPermissions(data.data);
        
        // Contributors don't need polling since they always have access
        shouldPollRef.current = data.data.role !== 'contributor';
      } else {
        setError(data.error || 'Failed to fetch permissions');
      }
    } catch (err) {
      console.error('❌ [Permissions] Error:', err);
      setError('Failed to fetch permissions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchPermissions();
    
    // ✅ Real-time subscription to event status changes
    const supabase = createSupabaseClient();
    console.log('📡 [Permissions] Setting up real-time subscription...');
    
    const channel = supabase
      .channel('permission_events_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_events',
          filter: `status=eq.live`,
        },
        (payload) => {
          console.log('🎪 [Permissions] Event went live! Refreshing permissions...', payload);
          fetchPermissions();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_events',
          filter: `status=eq.ended`,
        },
        (payload) => {
          console.log('⏹️ [Permissions] Event ended! Refreshing permissions...', payload);
          fetchPermissions();
        }
      )
      .subscribe();
    
    // Set up polling interval
    const interval = setInterval(() => {
      if (shouldPollRef.current) {
        console.log('🔄 [Permissions] Polling...');
        fetchPermissions();
      }
    }, 10000);
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userAddress]);

  // ✅ MEMOIZE: Prevent new object reference on every render
  return useMemo(() => ({
    permissions,
    isLoading,
    error,
    isBanned: permissions?.isBanned || false,
  }), [permissions, isLoading, error]);
}
