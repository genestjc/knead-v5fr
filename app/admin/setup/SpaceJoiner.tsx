'use client';

import { useState, useEffect } from 'react';
import { useJoinSpace } from '@towns-protocol/react-sdk';
import { ethers } from 'ethers';
import { ChannelCreator } from './ChannelCreator';

interface SpaceJoinerProps {
  spaceId: string;
  rpcUrl?: string;
}

export function SpaceJoiner({ spaceId, rpcUrl }: SpaceJoinerProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ NOW safe to call - only rendered when agent is connected
  const { joinSpace } = useJoinSpace(spaceId);

  // Auto-join on mount
  useEffect(() => {
    const join = async () => {
      if (hasJoined || isJoining || !joinSpace) return;
      
      setIsJoining(true);
      setError(null);

      try {
        if (typeof window === 'undefined' || !window.ethereum) {
          throw new Error('MetaMask not found');
        }

        console.log('🏠 Joining space:', spaceId);
        
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        
        await joinSpace(signer);
        
        console.log('✅ Joined space successfully');
        setHasJoined(true);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        
        // If already a member, that's fine
        if (errorMsg.includes('already') || errorMsg.includes('member')) {
          console.log('✅ Already a member of the space');
          setHasJoined(true);
        } else {
          console.error('Failed to join space:', err);
          setError(errorMsg);
        }
      } finally {
        setIsJoining(false);
      }
    };

    join();
  }, [hasJoined, isJoining, joinSpace, spaceId]);

  // Show loading or error
  if (!hasJoined) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="font-adonis text-5xl mb-2">Virtual Sharding Setup</h1>
        <p className="font-georgia-pro text-gray-600 mb-8">
          Setting up space membership...
        </p>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-adonis text-xl text-red-600 mb-2">Error Joining Space</h3>
            <p className="font-georgia-pro text-sm text-red-800">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setIsJoining(false);
                setHasJoined(false);
              }}
              className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="border rounded-lg p-6 bg-yellow-50 border-yellow-300">
            <div className="flex items-center gap-2">
              <span className="animate-spin text-yellow-600 text-xl">⏳</span>
              <span className="font-georgia-pro text-yellow-800">
                Joining space as member...
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ✅ Only render ChannelCreator AFTER joined
  return <ChannelCreator spaceId={spaceId} rpcUrl={rpcUrl} />;
}
