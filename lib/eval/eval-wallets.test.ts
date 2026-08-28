/**
 * The test wallets are useless if their signatures don't satisfy the real
 * verifier, and a signing mismatch fails as a plain 401 — indistinguishable
 * from "this wallet isn't a contributor". That ambiguity is expensive to debug
 * against a live endpoint, so the contract is pinned here instead.
 *
 * These run offline: viem recovers an EOA signature without touching the chain.
 *
 * Run with: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import { verifyWalletRequest } from '@/lib/auth/verify-wallet-request';
import { WALLET_AUTH_HEADERS } from '@/lib/auth/wallet-message';
import { signWalletAuthHeaders } from './eval-wallets';

const KEY = ethers.Wallet.createRandom().privateKey;
const URL_UNDER_TEST = 'https://kneadmag.com/api/dm/generate-dm-token';

async function signedRequest(
  body: unknown,
  overrides: Record<string, string> = {},
  url = URL_UNDER_TEST,
): Promise<NextRequest> {
  const serialized = JSON.stringify(body);
  const headers = await signWalletAuthHeaders({
    privateKey: KEY,
    method: 'POST',
    url,
    body: serialized,
  });

  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers, ...overrides },
    body: serialized,
  });
}

describe('signWalletAuthHeaders', () => {
  it('produces headers verifyWalletRequest accepts', async () => {
    const req = await signedRequest({ roomName: 'dm-abc-def-123' });
    const result = await verifyWalletRequest(req);

    assert.equal(result.ok, true, result.error);
    assert.equal(result.address, new ethers.Wallet(KEY).address.toLowerCase());
  });

  it('binds the signature to the body', async () => {
    // Same signature, different body: the request the wallet authorized is not
    // the request being sent. This is the check that stops a captured header
    // set from being replayed against a different room.
    const original = await signedRequest({ roomName: 'dm-abc-def-123' });
    const tampered = new NextRequest(URL_UNDER_TEST, {
      method: 'POST',
      headers: original.headers,
      body: JSON.stringify({ roomName: 'someone-elses-room' }),
    });

    const result = await verifyWalletRequest(tampered);
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });

  it('binds the signature to the path', async () => {
    const signedForOnePath = await signedRequest({ roomName: 'dm-abc' });
    const sentToAnother = new NextRequest(
      'https://kneadmag.com/api/dm/create-video-room',
      {
        method: 'POST',
        headers: signedForOnePath.headers,
        body: JSON.stringify({ roomName: 'dm-abc' }),
      },
    );

    const result = await verifyWalletRequest(sentToAnother);
    assert.equal(result.ok, false);
  });

  it('rejects a stale timestamp', async () => {
    // Six minutes old — one minute past the replay window.
    const stale = String(Date.now() - 6 * 60 * 1000);
    const req = await signedRequest({ roomName: 'dm-abc' }, {
      [WALLET_AUTH_HEADERS.timestamp]: stale,
    });

    const result = await verifyWalletRequest(req);
    assert.equal(result.ok, false);
  });

  it('signs the address in lowercase, as the routes compare it', async () => {
    const headers = await signWalletAuthHeaders({
      privateKey: KEY,
      method: 'POST',
      url: URL_UNDER_TEST,
      body: '{}',
    });

    const address = headers[WALLET_AUTH_HEADERS.address];
    assert.equal(address, address.toLowerCase());
  });
});
