'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { walletFetch } from '@/lib/auth/wallet-fetch';

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
        const thirdwebAuthToken =
          typeof wallet?.getAuthToken === 'function' ? await wallet.getAuthToken() : null;
        const request: RequestInit = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: address,
            thirdwebAuthToken: thirdwebAuthToken || undefined,
          }),
        };

        const response = thirdwebAuthToken
          ? await fetch('/api/auth/member-session', request)
          : await walletFetch('/api/auth/member-session', activeAccount, request);

        if (!cancelled && response.ok) {
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
