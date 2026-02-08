'use client';

import React, { ReactNode, useEffect, useState, useRef } from 'react';
import { DailyProvider as DailyReactProvider } from '@daily-co/daily-react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

interface DailyProviderProps {
  children: ReactNode;
}

export function DailyProvider({ children }: DailyProviderProps) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const callObjectRef = useRef<DailyCall | null>(null);

  useEffect(() => {
    // ✅ Prevent duplicate creation
    if (callObjectRef.current) {
      setCallObject(callObjectRef.current);
      return;
    }

    console.log('🎥 [DailyProvider] Creating call object...');
    console.log('📦 [DailyProvider] Daily.js version:', DailyIframe.version);
    
    try {
      // ✅ SIMPLIFIED: No strict constraints - let Daily handle device selection
      const daily = DailyIframe.createCallObject({
        // Removed audioSource/videoSource - Daily will auto-detect best devices
      });
      
      callObjectRef.current = daily;
      setCallObject(daily);

      console.log('✅ [DailyProvider] Call object created successfully');

      // ✅ Monitor for errors
      daily.on('error', (event) => {
        console.error('❌ [DailyProvider] Daily error:', event);
        if (event.errorMsg?.includes('Overconstrained')) {
          setError('Camera/microphone not available. Please check permissions.');
        }
      });

    } catch (err) {
      console.error('❌ [DailyProvider] Failed to create call object:', err);
      setError((err as Error).message || 'Failed to initialize video');
    }

    // ✅ Cleanup only on unmount
    return () => {
      console.log('🧹 [DailyProvider] Cleaning up call object');
      if (callObjectRef.current) {
        callObjectRef.current.destroy();
        callObjectRef.current = null;
      }
    };
  }, []); // Empty dependency - run once

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-6">
          <p className="font-georgia-pro text-red-600 mb-4">❌ {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!callObject) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-600">Initializing video...</p>
        </div>
      </div>
    );
  }

  return (
    <DailyReactProvider callObject={callObject}>
      {children}
    </DailyReactProvider>
  );
}
