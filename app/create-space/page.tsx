import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the client component, disabling SSR.
const CreateSpaceClient = dynamic(() => import('./create-space-client'), { 
  ssr: false,
  loading: () => <div className="flex h-screen w-full items-center justify-center">Loading...</div>
});

export default function CreateSpacePage() {
  // This server component simply renders our dynamic client component.
  return <CreateSpaceClient />;
}
