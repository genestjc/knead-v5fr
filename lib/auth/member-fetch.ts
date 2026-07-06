import type { Account } from 'thirdweb/wallets';
import { walletFetch } from './wallet-fetch';

type WalletWithAuthToken = {
  id?: string;
  getAuthToken?: () => string | null | Promise<string | null>;
};

type ThirdwebSessionResult =
  | { ok: true; attempted: true }
  | { ok: false; attempted: boolean };

function isInAppWallet(wallet?: WalletWithAuthToken): boolean {
  return wallet?.id === 'inApp' || wallet?.id === 'embedded';
}

function getStoredThirdwebAuthCookie(): string | null {
  if (typeof window === 'undefined') return null;

  const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
  if (!clientId) return null;

  // thirdweb v5 stores the in-app auth cookie here internally:
  // AUTH_TOKEN_LOCAL_STORAGE_NAME(clientId) => `walletToken-${clientId}`.
  return window.localStorage.getItem(`walletToken-${clientId}`);
}

async function getThirdwebAuthToken(wallet?: WalletWithAuthToken): Promise<string | null> {
  if (!isInAppWallet(wallet)) return null;

  const storedCookie = getStoredThirdwebAuthCookie();
  if (storedCookie) return storedCookie;

  if (typeof wallet?.getAuthToken === 'function') {
    try {
      const token = await wallet.getAuthToken();
      if (token) return token;
    } catch {
      // Some thirdweb wallet objects do not expose getAuthToken().
    }
  }

  return null;
}

async function createThirdwebMemberSession(
  account: Account,
  wallet?: WalletWithAuthToken,
): Promise<ThirdwebSessionResult> {
  const thirdwebAuthToken = await getThirdwebAuthToken(wallet);
  if (!thirdwebAuthToken) return { ok: false, attempted: false };

  const response = await fetch('/api/auth/member-session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: account.address,
      thirdwebAuthToken,
    }),
  });
  return { ok: response.ok, attempted: true };
}

async function createSignedMemberSession(account: Account): Promise<boolean> {
  const response = await walletFetch('/api/auth/member-session', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: account.address }),
  });
  return response.ok;
}

export async function createMemberSession(
  account: Account,
  wallet?: WalletWithAuthToken,
  opts: { allowSignatureFallback?: boolean } = {},
): Promise<boolean> {
  const thirdwebSession = await createThirdwebMemberSession(account, wallet);
  if (thirdwebSession.ok) return true;
  if (opts.allowSignatureFallback === false) return false;

  return createSignedMemberSession(account);
}

export async function memberFetch(
  input: RequestInfo | URL,
  account: Account | undefined,
  init: RequestInit = {},
  wallet?: WalletWithAuthToken,
): Promise<Response> {
  const first = await fetch(input, {
    ...init,
    credentials: 'include',
  });

  if (first.status !== 401 || !account) return first;

  const sessionReady = await createMemberSession(account, wallet, {
    allowSignatureFallback: true,
  });
  if (!sessionReady) return first;

  return fetch(input, {
    ...init,
    credentials: 'include',
  });
}
