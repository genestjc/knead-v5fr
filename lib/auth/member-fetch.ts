import type { Account } from 'thirdweb/wallets';

type WalletWithAuthToken = {
  id?: string;
  walletId?: string;
  getAuthToken?: () => string | null | Promise<string | null>;
};

type ThirdwebSessionResult =
  | { ok: true; attempted: true }
  | { ok: false; attempted: boolean };

let pendingSession:
  | {
      address: string;
      promise: Promise<boolean>;
    }
  | null = null;

function isInAppWallet(wallet?: WalletWithAuthToken): boolean {
  return (
    wallet?.id === 'inApp' ||
    wallet?.id === 'embedded' ||
    wallet?.walletId === 'inApp' ||
    wallet?.walletId === 'embedded'
  );
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

async function createSiweMemberSession(account: Account): Promise<boolean> {
  const challengeResponse = await fetch(
    `/api/auth/member-session?challenge=siwe&walletAddress=${encodeURIComponent(account.address)}`,
    {
      method: 'GET',
      credentials: 'include',
    },
  );
  if (!challengeResponse.ok) return false;

  const challenge = await challengeResponse.json().catch(() => null);
  if (!challenge?.message || typeof challenge.message !== 'string') return false;

  const signature = await account.signMessage({ message: challenge.message });

  const response = await fetch('/api/auth/member-session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: account.address,
      siweMessage: challenge.message,
      siweSignature: signature,
    }),
  });
  return response.ok;
}

async function createMemberSessionUncached(
  account: Account,
  wallet?: WalletWithAuthToken,
  opts: { allowSignatureFallback?: boolean } = {},
): Promise<boolean> {
  const thirdwebSession = await createThirdwebMemberSession(account, wallet);
  if (thirdwebSession.ok) return true;
  if (opts.allowSignatureFallback === false || isInAppWallet(wallet)) return false;

  return createSiweMemberSession(account);
}

export async function createMemberSession(
  account: Account,
  wallet?: WalletWithAuthToken,
  opts: { allowSignatureFallback?: boolean } = {},
): Promise<boolean> {
  if (opts.allowSignatureFallback === false) {
    return createMemberSessionUncached(account, wallet, opts);
  }

  const address = account.address.toLowerCase();
  if (pendingSession?.address === address) {
    return pendingSession.promise;
  }

  const promise = createMemberSessionUncached(account, wallet, opts).finally(() => {
    if (pendingSession?.promise === promise) {
      pendingSession = null;
    }
  });

  pendingSession = { address, promise };
  return promise;
}

async function shouldRefreshMemberSession(response: Response): Promise<boolean> {
  if (response.status === 401) return true;
  if (response.status !== 403) return false;

  const data = await response.clone().json().catch(() => null);
  const message =
    typeof data?.error === 'string'
      ? data.error
      : typeof data?.message === 'string'
        ? data.message
        : '';

  return /authenticated member|authenticated signer|wallet claim/i.test(message);
}

export async function memberFetch(
  input: RequestInfo | URL,
  account: Account | undefined,
  init: RequestInit = {},
  wallet?: WalletWithAuthToken,
  opts: { allowSignatureFallback?: boolean } = {},
): Promise<Response> {
  const first = await fetch(input, {
    ...init,
    credentials: 'include',
  });

  if (!account || !(await shouldRefreshMemberSession(first))) return first;

  if (first.status === 403) {
    await fetch('/api/auth/member-session', {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => {});
  }

  const sessionReady = await createMemberSession(account, wallet, {
    allowSignatureFallback: opts.allowSignatureFallback ?? true,
  });
  if (!sessionReady) return first;

  return fetch(input, {
    ...init,
    credentials: 'include',
  });
}
