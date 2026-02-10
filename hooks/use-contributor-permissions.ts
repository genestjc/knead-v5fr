/**
 * Contributor Permissions Hook
 * 
 * Checks NFT ownership to determine contributor permissions.
 * Replaces database-based role checks with blockchain verification.
 */

'use client';

import { useState, useEffect } from 'react';
import { getUserRole, type UserRole } from '@/lib/blockchain/check-nft-ownership';

interface ContributorPermissions {
  role: UserRole | null;
  isContributor: boolean;
  canAwardTokens: boolean;
  canModerate: boolean;
  canCreateDM: (recipientAddress: string) => Promise<boolean>;
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

  /**
   * Check if user can create DM with recipient
   * Both sender and recipient must be contributors
   * 
   * @param recipientAddress - Recipient's wallet address
   * @returns True if both are contributors
   */
  const canCreateDM = async (recipientAddress: string): Promise<boolean> => {
    if (!address) return false;

    try {
      // Both users must be contributors
      const [senderRole, recipientRole] = await Promise.all([
        getUserRole(address),
        getUserRole(recipientAddress)
      ]);

      return senderRole.role === 'contributor' && recipientRole.role === 'contributor';
    } catch (error) {
      console.error('Error checking DM permissions:', error);
      return false;
    }
  };

  return {
    role,
    isContributor,
    canAwardTokens,
    canModerate,
    canCreateDM,
    loading,
  };
}
