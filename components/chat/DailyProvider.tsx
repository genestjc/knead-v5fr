'use client';

import React, { ReactNode } from 'react';
import { DailyProvider as DailyReactProvider } from '@daily-co/daily-react';

interface DailyProviderProps {
  children: ReactNode;
}

/**
 * DailyProvider - Wrapper for Daily.co React SDK
 * Provides Daily context to child components
 */
export function DailyProvider({ children }: DailyProviderProps) {
  return (
    <DailyReactProvider>
      {children}
    </DailyReactProvider>
  );
}
