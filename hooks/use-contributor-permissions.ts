/**
 * Contributor Permissions Hook
 * 
 * Checks NFT ownership to determine contributor permissions.
 * Replaces database-based role checks with blockchain verification.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { getUserRole, type UserRole } from '@/lib/blockchain/check-nft-ownership';

interface ContributorPermissions {
  role: UserRole | null;
  isContributor: boolean;
  canAwardTokens: boolean;
  canModerate: boolean;
  loading: boolean;
}

/**
 * Hook to check contributor permissions via NFT ownership
 * 
 * @param address - User's wallet address
 * @returns Permissions based on NFT ownership
 */
export function useContributorPermissions(address: string | null | undefined): ContributorPermissions {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkPermissions() {
      if (!address) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const roleInfo = await getUserRole(address);
        
        if (mounted) {
          setRole(roleInfo.role);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking contributor permissions:', error);
        if (mounted) {
          setRole(null);
          setLoading(false);
        }
      }
    }

    checkPermissions();

    return () => {
      mounted = false;
    };
  }, [address]);

  const isContributor = role === 'contributor';
  const canAwardTokens = isContributor;
  const canModerate = isContributor;

  // ✅ MEMOIZE: Prevent new object reference on every render
  return useMemo(() => ({
    role,
    isContributor,
    canAwardTokens,
    canModerate,
    loading,
  }), [role, isContributor, canAwardTokens, canModerate, loading]);
}
