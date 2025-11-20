'use client';

import { useEffect, useState } from 'react';

export default function TestSDK() {
  const [status, setStatus] = useState('Not started');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function testSDK() {
      try {
        setStatus('Testing IndexedDB...');
        
        // Test if IndexedDB is available
        if (!window.indexedDB) {
          throw new Error('IndexedDB not available in this browser');
        }
        
        setStatus('IndexedDB available! Testing SDK import...');
        
        // Dynamic import to avoid SSR issues
        const { TownsSyncProvider } = await import('@towns-protocol/react-sdk');
        
        setStatus('SDK imported successfully! ✅');
        
      } catch (err: any) {
        console.error('SDK Test Error:', err);
        setError(err.message);
        setStatus('Failed ❌');
      }
    }
    
    testSDK();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Towns SDK Test</h1>
      <div className="mb-4">
        <strong>Status:</strong> {status}
      </div>
      {error && (
        <div className="p-4 bg-red-100 text-red-800 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <strong>Debug Info:</strong>
        <pre className="text-xs mt-2">
          {JSON.stringify({
            hasIndexedDB: typeof window !== 'undefined' && !!window.indexedDB,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
