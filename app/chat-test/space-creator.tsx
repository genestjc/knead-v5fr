'use client';

import { useState } from 'react';

interface SpaceCreatorProps {
  walletAddress: string;
  onSpaceCreated: (spaceId: string, defaultChannelId: string) => void;
}

export default function SpaceCreator({ walletAddress, onSpaceCreated }: SpaceCreatorProps) {
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateSpace = async () => {
    setCreatingSpace(true);
    setError(null);

    try {
      console.log('🏗️ Requesting backend to create Knead space...');
      
      const response = await fetch('/api/towns/create-space', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create space');
      }

      console.log('✅ Knead space ready:', data);

      if (data.alreadyExists) {
        console.log('ℹ️ Space already existed, using existing IDs');
      }

      onSpaceCreated(data.spaceId, data.defaultChannelId);
      
    } catch (err: unknown) {
      console.error('Failed to create space:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create Knead space';
      setError(errorMessage);
    } finally {
      setCreatingSpace(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-4">
        <h1 className="font-adonis text-4xl mb-4">Create Knead Space</h1>
        <p className="font-georgia-pro text-gray-600 mb-2">
          No Knead space exists yet. Create one to start the community!
        </p>
        <p className="font-georgia-pro text-sm text-gray-500 mb-6">
          This only needs to be done once - all users will join this space.
        </p>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="font-georgia-pro text-sm text-red-600">{error}</p>
          </div>
        )}

        {creatingSpace ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-600">
              Creating space on the backend... This may take a moment.
            </p>
          </>
        ) : (
          <button
            onClick={handleCreateSpace}
            className="px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
          >
            Create Knead Space
          </button>
        )}
      </div>
    </div>
  );
}
