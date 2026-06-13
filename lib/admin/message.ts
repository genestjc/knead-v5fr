/**
 * Canonical message an admin signs to authenticate a privileged API call.
 * Must stay byte-for-byte identical between the client signer and the server
 * verifier, so it lives in one shared (isomorphic, no 'use client') module.
 */
export function buildAdminAuthMessage(address: string, timestamp: string): string {
  return [
    'Knead Admin Authentication',
    '',
    'Sign this message to authorize an admin action. This signature cannot be reused after it expires.',
    `Address: ${address.toLowerCase()}`,
    `Timestamp: ${timestamp}`,
  ].join('\n');
}

/** Header names carrying the signed proof on admin requests. */
export const ADMIN_AUTH_HEADERS = {
  address: 'x-admin-address',
  timestamp: 'x-admin-timestamp',
  signature: 'x-admin-signature',
} as const;

/** How long a signed admin request stays valid (replay window). */
export const ADMIN_AUTH_MAX_AGE_MS = 5 * 60 * 1000;
