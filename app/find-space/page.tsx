import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the client component, disabling SSR.
const FindSpaceClient = dynamic(() => import('./find-space-client'), { 
  ssr: false,
  loading: () => <div className="flex h-screen w-full items-center justify-center">Loading...</div>
});

export default function FindSpacePage() {
  // This server component simply renders our dynamic client component.
  return <FindSpaceClient />;
}
