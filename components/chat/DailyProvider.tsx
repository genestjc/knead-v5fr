'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { DailyProvider as DailyReactProvider } from '@daily-co/daily-react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

interface DailyProviderProps {
  children: ReactNode;
}

export function DailyProvider({ children }: DailyProviderProps) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);

  useEffect(() => {
    const daily = DailyIframe.createCallObject({
      audioSource: true,
      videoSource: true,
    });
    
    setCallObject(daily);

    return () => {
      daily.destroy();
    };
  }, []);

  // ✅ FIX: Wait for call object before rendering children with provider
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
