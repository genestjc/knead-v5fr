'use client';

import { useQuery } from '@tanstack/react-query';

interface UserProfile {
  alias: string | null;
  avatar: string | null;
  displayName: string;
  walletAddress: string | null;
  role?: string;
}

async function fetchUserProfile(walletAddress: string): Promise<UserProfile> {
  const response = await fetch(`/api/chat/user?address=${encodeURIComponent(walletAddress)}`);
  const data = await response.json();

  if (data.success && data.user) {
    return {
      alias: data.user.alias,
      avatar: data.user.avatar,
      displayName: data.user.displayName,
      walletAddress,
      role: data.user.role,
    };
  }

  return {
    alias: null,
    avatar: null,
    displayName: walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4),
    walletAddress,
    role: undefined,
  };
}

/**
 * Hook to fetch and cache a user profile using React Query.
 * Profiles are cached for 5 minutes with automatic deduplication.
 */
export function useUserProfile(walletAddress: string | null | undefined) {
  return useQuery<UserProfile>({
    queryKey: ['user-profile', walletAddress],
    queryFn: () => fetchUserProfile(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
