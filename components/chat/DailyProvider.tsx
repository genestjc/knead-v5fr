'use client';

import React, { ReactNode, useEffect, useState, useRef } from 'react';
import { DailyProvider as DailyReactProvider } from '@daily-co/daily-react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

interface DailyProviderProps {
  children: ReactNode;
}

export function DailyProvider({ children }: DailyProviderProps) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const callObjectRef = useRef<DailyCall | null>(null);

  useEffect(() => {
    // ✅ FIX: Prevent duplicate creation
    if (callObjectRef.current) {
      setCallObject(callObjectRef.current);
      return;
    }

    console.log('🎥 [DailyProvider] Creating call object...');
    
    const daily = DailyIframe.createCallObject({
      audioSource: true,
      videoSource: true,
    });
    
    callObjectRef.current = daily;
    setCallObject(daily);

    console.log('✅ [DailyProvider] Call object created');

    // ✅ FIX: Only destroy on component unmount, not on re-render
    return () => {
      console.log('🧹 [DailyProvider] Cleaning up call object');
      if (callObjectRef.current) {
        callObjectRef.current.destroy();
        callObjectRef.current = null;
      }
    };
  }, []); // ✅ Empty dependency array - only run once

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
