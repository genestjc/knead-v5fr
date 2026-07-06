import type { SignedRequestContext } from '@/lib/auth/request-binding';

/**
 * Canonical message an admin signs to authenticate a privileged API call.
 * Must stay byte-for-byte identical between the client signer and the server
 * verifier, so it lives in one shared (isomorphic, no 'use client') module.
 */
export function buildAdminAuthMessage(
  address: string,
  timestamp: string,
  request: SignedRequestContext,
): string {
  return [
    'Knead Admin Authentication',
    '',
    'Sign this message to authorize this exact admin request. This signature cannot be reused for a different action.',
    `Address: ${address.toLowerCase()}`,
    `Timestamp: ${timestamp}`,
    `Method: ${request.method.toUpperCase()}`,
    `Path: ${request.path}`,
    `Body SHA-256: ${request.bodyHash}`,
  ].join('\n');
}

/** Header names carrying the signed proof on admin requests. */
export const ADMIN_AUTH_HEADERS = {
  address: 'x-admin-address',
  timestamp: 'x-admin-timestamp',
  method: 'x-admin-method',
  path: 'x-admin-path',
  bodyHash: 'x-admin-body-sha256',
  signature: 'x-admin-signature',
} as const;

/** How long a signed admin request stays valid (replay window). */
export const ADMIN_AUTH_MAX_AGE_MS = 5 * 60 * 1000;
