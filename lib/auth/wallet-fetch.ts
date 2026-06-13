import type { Account } from 'thirdweb/wallets';
import { WALLET_AUTH_HEADERS, buildWalletAuthMessage } from './wallet-message';

/**
 * One signature is reused for this long so members aren't prompted on every
 * call. Kept comfortably under the server's 5-minute replay window so a cached
 * proof never arrives already-expired.
 */
const REUSE_WINDOW_MS = 4 * 60 * 1000;

let cached: { address: string; headers: Record<string, string>; expiresAt: number } | null = null;

/**
 * Prompts the connected wallet to sign the canonical wallet-auth message and
 * returns the headers proving it. Used by member/contributor UI calls in place
 * of the old (spoofable) address body/query param.
 *
 * The signed headers are cached in memory for a few minutes, so a burst of
 * calls only triggers one wallet prompt. Pass `forceFresh` to bypass the cache.
 *
 * This is the member-facing analogue of `buildAdminAuthHeaders` in
 * `lib/admin/admin-fetch.ts`.
 */
export async function buildWalletAuthHeaders(
  account: Account,
  opts: { forceFresh?: boolean } = {},
): Promise<Record<string, string>> {
  const address = account.address.toLowerCase();
  const now = Date.now();

  if (!opts.forceFresh && cached && cached.address === address && cached.expiresAt > now) {
    return cached.headers;
  }

  const timestamp = now.toString();
  const signature = await account.signMessage({
    message: buildWalletAuthMessage(address, timestamp),
  });
  const headers = {
    [WALLET_AUTH_HEADERS.address]: address,
    [WALLET_AUTH_HEADERS.timestamp]: timestamp,
    [WALLET_AUTH_HEADERS.signature]: signature,
  };

  cached = { address, headers, expiresAt: now + REUSE_WINDOW_MS };
  return headers;
}

/** Clear the cached signature (e.g. on wallet disconnect / account switch). */
export function clearWalletAuthCache(): void {
  cached = null;
}

/**
 * Drop-in wrapper around fetch() for wallet-authenticated endpoints. Signs the
 * request with the active wallet (reusing a recent signature when possible) and
 * attaches the proof headers.
 *
 *   const res = await walletFetch('/api/chat/award-tokens', account, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ participantAddress, amount }),
 *   });
 */
export async function walletFetch(
  input: string,
  account: Account,
  init: RequestInit = {},
): Promise<Response> {
  const authHeaders = await buildWalletAuthHeaders(account);
  return fetch(input, {
    ...init,
    headers: { ...(init.headers ?? {}), ...authHeaders },
  });
}
