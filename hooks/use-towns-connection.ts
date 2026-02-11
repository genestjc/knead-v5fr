'use client';

import { useEffect, useState } from 'react';
import { useAgentConnection } from '@towns-protocol/react-sdk';
import { clearTownsCache, recordSyncError } from '@/lib/towns/cache-manager';

export function useTownsConnectionMonitor() {
  const { isAgentConnected, isAgentConnecting } = useAgentConnection();
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastSuccessfulConnection, setLastSuccessfulConnection] = useState(Date.now());

  useEffect(() => {
    // Monitor connection health every 10 seconds
    const healthCheckInterval = setInterval(() => {
      if (!isAgentConnected && !isAgentConnecting) {
        console.warn('🔴 Towns disconnected');
        setReconnectAttempts(prev => prev + 1);
        
        // Record sync error for cache clearing
        recordSyncError();
        
        // If more than 5 failed reconnects, clear cache and reload
        if (reconnectAttempts > 5) {
          console.error('❌ Too many reconnect failures - clearing cache and reloading');
          clearTownsCache();
          setTimeout(() => window.location.reload(), 1000);
        }
      } else if (isAgentConnected) {
        // Connected - reset counter
        if (reconnectAttempts > 0) {
          console.log('✅ Towns reconnected successfully');
          setReconnectAttempts(0);
          setLastSuccessfulConnection(Date.now());
          
          // Clear error record
          localStorage.removeItem('knead_last_sync_error');
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(healthCheckInterval);
  }, [isAgentConnected, isAgentConnecting, reconnectAttempts]);

  return {
    isConnected: isAgentConnected,
    isConnecting: isAgentConnecting,
    reconnectAttempts,
    lastSuccessfulConnection,
  };
}
