/**
 * Canonical message any wallet signs to prove control of its private key for a
 * privileged (non-admin) API call — contributor tipping, agent commands, DAO
 * votes, live-event tokens, etc.
 *
 * Must stay byte-for-byte identical between the client signer and the server
 * verifier, so it lives in one shared (isomorphic, no 'use client') module.
 *
 * This is the contributor/member analogue of `lib/admin/message.ts`. It proves
 * *authentication* (you hold this wallet); each route layers its own
 * *authorization* (NFT / role / event membership) on top of the recovered
 * address.
 */
export function buildWalletAuthMessage(address: string, timestamp: string): string {
  return [
    'Knead Wallet Authentication',
    '',
    'Sign this message to authorize this action. This signature cannot be reused after it expires.',
    `Address: ${address.toLowerCase()}`,
    `Timestamp: ${timestamp}`,
  ].join('\n');
}

/** Header names carrying the signed proof on wallet-authenticated requests. */
export const WALLET_AUTH_HEADERS = {
  address: 'x-wallet-address',
  timestamp: 'x-wallet-timestamp',
  signature: 'x-wallet-signature',
} as const;

/** How long a signed wallet request stays valid (replay window). */
export const WALLET_AUTH_MAX_AGE_MS = 5 * 60 * 1000;
