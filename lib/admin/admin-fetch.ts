import type { Account } from 'thirdweb/wallets';
import { ADMIN_AUTH_HEADERS, buildAdminAuthMessage } from './message';
import {
  canonicalRequestPath,
  requestBodyHash,
  type SignedRequestContext,
} from '@/lib/auth/request-binding';

/**
 * One signature is reused for this long so admins aren't prompted on every
 * call. Kept comfortably under the server's 5-minute replay window so a cached
 * proof never arrives already-expired.
 */
const REUSE_WINDOW_MS = 4 * 60 * 1000;

let cached: {
  address: string;
  requestKey: string;
  headers: Record<string, string>;
  expiresAt: number;
} | null = null;

function requestKey(request: SignedRequestContext): string {
  return `${request.method.toUpperCase()} ${request.path} ${request.bodyHash}`;
}

function resolveRequestInput(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === 'string' && input.startsWith('/')) {
    return new URL(input, window.location.origin).toString();
  }
  return input;
}

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
  request: SignedRequestContext,
  opts: { forceFresh?: boolean } = {},
): Promise<Record<string, string>> {
  const address = account.address.toLowerCase();
  const now = Date.now();
  const key = requestKey(request);

  if (
    !opts.forceFresh &&
    cached &&
    cached.address === address &&
    cached.requestKey === key &&
    cached.expiresAt > now
  ) {
    return cached.headers;
  }

  const timestamp = now.toString();
  const signature = await account.signMessage({
    message: buildAdminAuthMessage(address, timestamp, request),
  });
  const headers = {
    [ADMIN_AUTH_HEADERS.address]: address,
    [ADMIN_AUTH_HEADERS.timestamp]: timestamp,
    [ADMIN_AUTH_HEADERS.method]: request.method.toUpperCase(),
    [ADMIN_AUTH_HEADERS.path]: request.path,
    [ADMIN_AUTH_HEADERS.bodyHash]: request.bodyHash,
    [ADMIN_AUTH_HEADERS.signature]: signature,
  };

  cached = { address, requestKey: key, headers, expiresAt: now + REUSE_WINDOW_MS };
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
  input: RequestInfo | URL,
  account: Account,
  init: RequestInit = {},
): Promise<Response> {
  const unsignedRequest = new Request(resolveRequestInput(input), init);
  const requestContext: SignedRequestContext = {
    method: unsignedRequest.method.toUpperCase(),
    path: canonicalRequestPath(unsignedRequest.url),
    bodyHash: await requestBodyHash(unsignedRequest),
  };
  const authHeaders = await buildAdminAuthHeaders(account, requestContext);
  const headers = new Headers(unsignedRequest.headers);
  for (const [key, value] of Object.entries(authHeaders)) headers.set(key, value);
  return fetch(new Request(unsignedRequest, { headers }));
}
