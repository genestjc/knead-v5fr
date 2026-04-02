'use client';

import { useState, useEffect } from 'react';
import { useJoinSpace } from '@towns-protocol/react-sdk';
import { useActiveAccount } from 'thirdweb/react';
import { createTownsSigner } from '@/lib/towns-signer-adapter';
import { client, activeChain } from '@/thirdweb-client';
import { ChannelCreator } from './ChannelCreator';

interface SpaceJoinerProps {
  spaceId: string;
  rpcUrl?: string;
}

export function SpaceJoiner({ spaceId, rpcUrl }: SpaceJoinerProps) {
  const account = useActiveAccount();
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Call without spaceId parameter (pass to joinSpace function instead)
  const { joinSpace } = useJoinSpace();

  // Auto-join on mount
  useEffect(() => {
    const join = async () => {
      if (hasJoined || isJoining || !joinSpace || !account) return;
      
      setIsJoining(true);
      setError(null);

      try {
        console.log('🏠 Joining space:', spaceId);
        console.log('👤 User:', account.address);
        
        // ✅ Use createTownsSigner like your chat does
        const signer = await createTownsSigner(account, client, activeChain);
        console.log('✅ Signer created');
        
        // ✅ Pass spaceId as first argument, signer as second
        // ✅ Use skipMintMembership option
        await joinSpace(spaceId, signer, {
          skipMintMembership: false, // Mint if not a member
        });
        
        console.log('✅ Joined space successfully');
        setHasJoined(true);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        
        // If already a member, that's fine
        if (errorMsg.includes('already a member') || errorMsg.includes('already')) {
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
  }, [hasJoined, isJoining, joinSpace, spaceId, account]);

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
            <p className="font-georgia-pro text-sm text-red-800 mb-4">{error}</p>
            <details className="mb-4">
              <summary className="cursor-pointer text-sm text-gray-600">Technical Details</summary>
              <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-auto">
                {JSON.stringify({ error, spaceId, userAddress: account?.address }, null, 2)}
              </pre>
            </details>
            <button
              onClick={() => {
                setError(null);
                setIsJoining(false);
                setHasJoined(false);
              }}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
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
            <p className="text-xs text-gray-600 mt-2">
              User: {account?.address?.slice(0, 10)}...
            </p>
          </div>
        )}
      </div>
    );
  }

  // ✅ Only render ChannelCreator AFTER joined
  return <ChannelCreator spaceId={spaceId} rpcUrl={rpcUrl} />;
}
