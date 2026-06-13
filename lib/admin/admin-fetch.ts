import type { Account } from 'thirdweb/wallets';
import { ADMIN_AUTH_HEADERS, buildAdminAuthMessage } from './message';

/**
 * One signature is reused for this long so admins aren't prompted on every
 * call. Kept comfortably under the server's 5-minute replay window so a cached
 * proof never arrives already-expired.
 */
const REUSE_WINDOW_MS = 4 * 60 * 1000;

let cached: { address: string; headers: Record<string, string>; expiresAt: number } | null = null;

/**
 * Prompts the connected wallet to sign the canonical admin-auth message and
 * returns the headers proving it. Used by all admin UI calls in place of the
 * old (spoofable) `adminAddress` query/body param.
 *
 * The signed headers are cached in memory for a few minutes, so a burst of
 * admin calls (list fetch + actions) only triggers one wallet prompt. Pass
 * `forceFresh` to bypass the cache.
 */
export async function buildAdminAuthHeaders(
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
    message: buildAdminAuthMessage(address, timestamp),
  });
  const headers = {
    [ADMIN_AUTH_HEADERS.address]: address,
    [ADMIN_AUTH_HEADERS.timestamp]: timestamp,
    [ADMIN_AUTH_HEADERS.signature]: signature,
  };

  cached = { address, headers, expiresAt: now + REUSE_WINDOW_MS };
  return headers;
}

/** Clear the cached signature (e.g. on wallet disconnect / account switch). */
export function clearAdminAuthCache(): void {
  cached = null;
}

/**
 * Drop-in wrapper around fetch() for admin endpoints. Signs the request with
 * the active wallet (reusing a recent signature when possible) and attaches the
 * proof headers.
 *
 *   const res = await adminFetch('/api/admin/ban-user', account, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ userAddress, ban: true }),
 *   });
 */
export async function adminFetch(
  input: string,
  account: Account,
  init: RequestInit = {},
): Promise<Response> {
  const authHeaders = await buildAdminAuthHeaders(account);
  return fetch(input, {
    ...init,
    headers: { ...(init.headers ?? {}), ...authHeaders },
  });
}
