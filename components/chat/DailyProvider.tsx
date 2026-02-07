'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { DailyProvider as DailyReactProvider } from '@daily-co/daily-react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

interface DailyProviderProps {
  children: ReactNode;
}

/**
 * DailyProvider - Wrapper for Daily.co React SDK
 * Creates and manages the Daily call object
 */
export function DailyProvider({ children }: DailyProviderProps) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);

  useEffect(() => {
    // Create call object once on mount
    const daily = DailyIframe.createCallObject({
      audioSource: true,
      videoSource: true,
    });
    
    setCallObject(daily);

    // Cleanup on unmount
    return () => {
      daily.destroy();
    };
  }, []);

  if (!callObject) {
    return <>{children}</>;
  }

  return (
    <DailyReactProvider callObject={callObject}>
      {children}
    </DailyReactProvider>
  );
}
