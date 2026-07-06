'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { createMemberSession } from '@/lib/auth/member-fetch';

type WalletWithAuthToken = {
  getAuthToken?: () => string | null | Promise<string | null>;
};

export function MemberSessionSync() {
  const account = useActiveAccount();
  const wallet = useActiveWallet() as WalletWithAuthToken | undefined;
  const syncedAddress = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncSession() {
      const activeAccount = account;
      const address = activeAccount?.address?.toLowerCase();
      if (!activeAccount || !address) {
        if (syncedAddress.current) {
          await fetch('/api/auth/member-session', { method: 'DELETE' }).catch(() => {});
          syncedAddress.current = null;
        }
        return;
      }

      if (syncedAddress.current === address) return;

      try {
        const sessionReady = await createMemberSession(activeAccount, wallet, {
          allowSignatureFallback: false,
        });
        if (!cancelled && sessionReady) {
          syncedAddress.current = address;
        }
      } catch (error) {
        console.warn('[member-session] Failed to sync member session:', error);
      }
    }

    syncSession();
    return () => {
      cancelled = true;
    };
  }, [account, account?.address, wallet]);

  return null;
}
