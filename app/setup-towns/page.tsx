'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Force dynamic rendering - disable static generation
export const dynamic = 'force-dynamic';

// Dynamically import the actual component with no SSR
const SetupTownsContent = dynamic(() => import('./setup-towns-content'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
    </div>
  ),
});

export default function SetupTownsPage() {
  return <SetupTownsContent />;
}
