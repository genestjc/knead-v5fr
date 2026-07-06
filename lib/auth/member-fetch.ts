import type { Account } from 'thirdweb/wallets';
import { walletFetch } from './wallet-fetch';

async function createSignedMemberSession(account: Account): Promise<boolean> {
  const response = await walletFetch('/api/auth/member-session', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: account.address }),
  });
  return response.ok;
}

export async function memberFetch(
  input: RequestInfo | URL,
  account: Account | undefined,
  init: RequestInit = {},
): Promise<Response> {
  const first = await fetch(input, {
    ...init,
    credentials: 'include',
  });

  if (first.status !== 401 || !account) return first;

  const sessionReady = await createSignedMemberSession(account);
  if (!sessionReady) return first;

  return fetch(input, {
    ...init,
    credentials: 'include',
  });
}

