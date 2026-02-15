'use client';

import { useEffect } from 'react';
import { useMember } from '@towns-protocol/react-sdk';

interface UserWalletResolverProps {
  spaceId: string;
  userId: string;
  onResolved: (userId: string, walletAddress: string | null) => void;
}

/**
 * Invisible component that resolves a userId to wallet address
 * Calls onResolved when complete
 */
export function UserWalletResolver({
  spaceId,
  userId,
  onResolved,
}: UserWalletResolverProps) {
  const { data: member, isLoading } = useMember({ streamId: spaceId, userId });

  useEffect(() => {
    if (!isLoading && member) {
      const walletAddress = member.ensAddress || null;
      onResolved(userId, walletAddress);
    }
  }, [isLoading, member, userId, onResolved]);

  return null; // Invisible component
}
