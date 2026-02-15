'use client';

import { useState, useEffect } from 'react';
import { useMember } from '@towns-protocol/react-sdk';

interface UserWalletCache {
  [userId: string]: string | null;
}

/**
 * Resolve a single Towns userId to wallet address
 */
export function useTownsUserWallet(spaceId: string, userId: string | null) {
  const { data: member, isLoading } = useMember(
    userId ? { streamId: spaceId, userId } : null
  );

  return {
    walletAddress: member?.ensAddress || null,
    isLoading,
  };
}

/**
 * Resolve multiple Towns userIds to wallet addresses efficiently
 * Caches results to avoid redundant calls
 */
export function useTownsUserWallets(spaceId: string, userIds: string[]) {
  const [walletCache, setWalletCache] = useState<UserWalletCache>({});
  const [loadingUsers, setLoadingUsers] = useState<Set<string>>(new Set());

  // Only resolve userIds we haven't cached yet
  const uncachedUserIds = userIds.filter(
    (userId) => !walletCache[userId] && !loadingUsers.has(userId)
  );

  return {
    getWalletAddress: (userId: string) => walletCache[userId] || null,
    isLoading: uncachedUserIds.length > 0 || loadingUsers.size > 0,
    walletCache,
  };
}
