'use client';

import { useEffect, useState } from 'react';
import { useMember } from '@towns-protocol/react-sdk';

interface UserWalletResolverProps {
  spaceId: string;
  userId: string;
  onResolved: (userId: string, walletAddress: string | null) => void;
}

/**
 * Invisible component that resolves Towns userId to wallet address
 * Uses multi-tier fallback:
 * 1. Towns SDK (member.ensAddress)
 * 2. Direct check (if userId is 0x... format)
 * 3. Supabase fallback (stored wallet addresses)
 */
export function UserWalletResolver({
  spaceId,
  userId,
  onResolved,
}: UserWalletResolverProps) {
  const { data: member, isLoading } = useMember({ streamId: spaceId, userId });
  const [hasResolved, setHasResolved] = useState(false);

  useEffect(() => {
    if (isLoading || hasResolved) return;

    const resolveWallet = async () => {
      // ✅ STEP 1: Try Towns SDK first (member.ensAddress)
      if (member?.ensAddress) {
        console.log('✅ Resolved via Towns SDK:', { 
          userId: userId.slice(0, 10) + '...', 
          wallet: member.ensAddress.slice(0, 10) + '...' 
        });
        onResolved(userId, member.ensAddress);
        setHasResolved(true);
        return;
      }

      // ✅ STEP 2: Fallback - Check if userId IS the wallet address (0x... format)
      if (userId.startsWith('0x') && userId.length === 42) {
        console.log('✅ userId is already a wallet address:', userId.slice(0, 10) + '...');
        onResolved(userId, userId);
        setHasResolved(true);
        return;
      }

      // ✅ STEP 3: Fallback - Query Supabase for stored wallet
      try {
        console.log('🔍 Trying Supabase fallback for userId:', userId.slice(0, 10) + '...');
        const response = await fetch(`/api/towns/resolve-wallet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        const data = await response.json();
        
        if (data.success && data.walletAddress) {
          console.log('✅ Resolved via Supabase:', {
            userId: userId.slice(0, 10) + '...',
            wallet: data.walletAddress.slice(0, 10) + '...',
          });
          onResolved(userId, data.walletAddress);
          setHasResolved(true);
          return;
        }
      } catch (error) {
        console.error('Failed Supabase fallback:', error);
      }

      // ❌ All resolution methods failed
      console.warn('⚠️ Could not resolve wallet for userId:', userId.slice(0, 10) + '...');
      onResolved(userId, null);
      setHasResolved(true);
    };

    // ✅ Call async function properly in useEffect
    void resolveWallet();
  }, [isLoading, member, userId, onResolved, hasResolved]);

  return null; // Invisible component
}
