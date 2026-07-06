import type { Account } from 'thirdweb/wallets';
import { WALLET_AUTH_HEADERS, buildWalletAuthMessage } from './wallet-message';
import {
  canonicalRequestPath,
  requestBodyHash,
  type SignedRequestContext,
} from './request-binding';

/**
 * One signature is reused for this long so members aren't prompted on every
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
    message: buildWalletAuthMessage(address, timestamp, request),
  });
  const headers = {
    [WALLET_AUTH_HEADERS.address]: address,
    [WALLET_AUTH_HEADERS.timestamp]: timestamp,
    [WALLET_AUTH_HEADERS.method]: request.method.toUpperCase(),
    [WALLET_AUTH_HEADERS.path]: request.path,
    [WALLET_AUTH_HEADERS.bodyHash]: request.bodyHash,
    [WALLET_AUTH_HEADERS.signature]: signature,
  };

  cached = { address, requestKey: key, headers, expiresAt: now + REUSE_WINDOW_MS };
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
  const authHeaders = await buildWalletAuthHeaders(account, requestContext);
  const headers = new Headers(unsignedRequest.headers);
  for (const [key, value] of Object.entries(authHeaders)) headers.set(key, value);
  return fetch(new Request(unsignedRequest, { headers }));
}
