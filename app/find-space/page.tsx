import dynamic from 'next/dynamic';
import React from 'react';

// This dynamically imports our client component and explicitly disables Server-Side Rendering (SSR).
// This is the guaranteed way to fix the prerendering error.
const FindSpaceClient = dynamic(() => import('./find-space-client'), { 
  ssr: false,
  // Optional: show a loading skeleton while the client component loads
  loading: () => <div className="text-center p-8">Loading...</div>
});

export default function FindSpacePage() {
  // This page component now only renders the dynamic client component.
  // It contains no hooks and is safe to run on the server.
  return <FindSpaceClient />;
}
