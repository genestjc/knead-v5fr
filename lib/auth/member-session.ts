import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import { base } from 'viem/chains';
import {
  hasWalletAuthHeaders,
  verifyWalletRequest,
  type WalletAuthResult,
} from './verify-wallet-request';

export const MEMBER_SESSION_COOKIE = 'knead_member_session';
export const MEMBER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const SIWE_NONCE_COOKIE = 'knead_siwe_nonce';
export const SIWE_NONCE_MAX_AGE_SECONDS = 10 * 60;

type MemberSessionProvider = 'thirdweb' | 'wallet' | 'siwe';

interface MemberSessionPayload {
  address: string;
  provider: MemberSessionProvider;
  iat: number;
  exp: number;
}

interface SiweNoncePayload {
  address: string;
  nonce: string;
  exp: number;
}

export interface MemberAuthResult {
  ok: boolean;
  address?: string;
  provider?: MemberSessionProvider;
  error?: string;
  status?: number;
}

export interface SiweChallenge {
  address: string;
  message: string;
  nonce: string;
  expiresAt: string;
}

const siweProvider = new ethers.providers.JsonRpcProvider(
  process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
);

function getSessionSecret(): string | null {
  return (
    process.env.MEMBER_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.THIRDWEB_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null
  );
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function encodePayload(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload<T>(encoded: string): T | null {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function createMemberSessionValue(
  address: string,
  provider: MemberSessionProvider,
  now = Date.now(),
): string {
  const secret = getSessionSecret();
  if (!secret) throw new Error('MEMBER_SESSION_SECRET or another server secret is required');

  const payload = encodePayload({
    address: address.toLowerCase(),
    provider,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + MEMBER_SESSION_MAX_AGE_SECONDS,
  });
  return `${payload}.${sign(payload, secret)}`;
}

export function readMemberSession(req: NextRequest): MemberAuthResult {
  const secret = getSessionSecret();
  if (!secret) return { ok: false, error: 'Member sessions are not configured', status: 500 };

  const raw = req.cookies.get(MEMBER_SESSION_COOKIE)?.value;
  if (!raw) return { ok: false, error: 'Missing member session', status: 401 };

  const [payloadValue, signature] = raw.split('.');
  if (!payloadValue || !signature || !safeEqualHex(signature, sign(payloadValue, secret))) {
    return { ok: false, error: 'Invalid member session', status: 401 };
  }

  const payload = decodePayload<MemberSessionPayload>(payloadValue);
  const now = Math.floor(Date.now() / 1000);
  if (!payload || !/^0x[a-f0-9]{40}$/.test(payload.address) || payload.exp <= now) {
    return { ok: false, error: 'Expired member session', status: 401 };
  }

  return { ok: true, address: payload.address, provider: payload.provider };
}

export function setMemberSessionCookie(
  res: NextResponse,
  address: string,
  provider: MemberSessionProvider,
): void {
  res.cookies.set(MEMBER_SESSION_COOKIE, createMemberSessionValue(address, provider), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MEMBER_SESSION_MAX_AGE_SECONDS,
  });
}

export function clearMemberSessionCookie(res: NextResponse): void {
  res.cookies.set(MEMBER_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

function requestDomain(req: NextRequest): string {
  return req.headers.get('host') ?? new URL(req.url).host;
}

function requestOrigin(req: NextRequest): string {
  const url = new URL(req.url);
  const host = requestDomain(req);
  return `${url.protocol}//${host}`;
}

function createNonceValue(address: string, nonce: string, now = Date.now()): string {
  const secret = getSessionSecret();
  if (!secret) throw new Error('MEMBER_SESSION_SECRET or another server secret is required');

  const payload = encodePayload({
    address: address.toLowerCase(),
    nonce,
    exp: Math.floor(now / 1000) + SIWE_NONCE_MAX_AGE_SECONDS,
  });
  return `${payload}.${sign(payload, secret)}`;
}

function readSiweNonce(req: NextRequest): SiweNoncePayload | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const raw = req.cookies.get(SIWE_NONCE_COOKIE)?.value;
  if (!raw) return null;

  const [payloadValue, signature] = raw.split('.');
  if (!payloadValue || !signature || !safeEqualHex(signature, sign(payloadValue, secret))) {
    return null;
  }

  const payload = decodePayload<SiweNoncePayload>(payloadValue);
  const now = Math.floor(Date.now() / 1000);
  if (
    !payload ||
    !/^0x[a-f0-9]{40}$/.test(payload.address) ||
    !/^[a-f0-9]{32}$/.test(payload.nonce) ||
    payload.exp <= now
  ) {
    return null;
  }

  return payload;
}

export function createSiweChallenge(req: NextRequest, address: string, now = Date.now()): SiweChallenge {
  let checksumAddress: string;
  try {
    checksumAddress = ethers.utils.getAddress(address);
  } catch {
    throw new Error('Invalid wallet address');
  }

  const nonce = randomBytes(16).toString('hex');
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + SIWE_NONCE_MAX_AGE_SECONDS * 1000).toISOString();
  const message = new SiweMessage({
    domain: requestDomain(req),
    address: checksumAddress,
    statement: 'Sign in to Knead. This does not authorize a transaction or move funds.',
    uri: requestOrigin(req),
    version: '1',
    chainId: base.id,
    nonce,
    issuedAt,
    expirationTime: expiresAt,
  }).prepareMessage();

  return { address: checksumAddress.toLowerCase(), message, nonce, expiresAt };
}

export function setSiweNonceCookie(res: NextResponse, challenge: SiweChallenge): void {
  res.cookies.set(SIWE_NONCE_COOKIE, createNonceValue(challenge.address, challenge.nonce), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SIWE_NONCE_MAX_AGE_SECONDS,
  });
}

export function clearSiweNonceCookie(res: NextResponse): void {
  res.cookies.set(SIWE_NONCE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function verifySiweMemberMessage(
  req: NextRequest,
  message: string,
  signature: string,
  expectedAddress?: string,
): Promise<string> {
  let siwe: SiweMessage;
  try {
    siwe = new SiweMessage(message);
  } catch {
    throw new Error('Invalid SIWE message');
  }

  const messageAddress = siwe.address.toLowerCase();
  const expected = expectedAddress ? ethers.utils.getAddress(expectedAddress).toLowerCase() : undefined;
  if (expected && messageAddress !== expected) {
    throw new Error('SIWE wallet does not match requested session wallet');
  }

  if (new URL(siwe.uri).origin !== requestOrigin(req)) {
    throw new Error('SIWE URI does not match request');
  }

  if (siwe.version !== '1' || siwe.chainId !== base.id) {
    throw new Error('Unsupported SIWE message');
  }

  const now = Date.now();
  if (!siwe.issuedAt || Number.isNaN(Date.parse(siwe.issuedAt)) || Date.parse(siwe.issuedAt) > now + 60_000) {
    throw new Error('Invalid SIWE issued time');
  }
  if (!siwe.expirationTime || Number.isNaN(Date.parse(siwe.expirationTime)) || Date.parse(siwe.expirationTime) <= now) {
    throw new Error('Expired SIWE message');
  }

  const nonce = readSiweNonce(req);
  if (!nonce || nonce.address !== messageAddress || nonce.nonce !== siwe.nonce) {
    throw new Error('Invalid or expired SIWE nonce');
  }

  const result = await siwe.verify(
    {
      signature,
      domain: requestDomain(req),
      nonce: nonce.nonce,
      time: new Date(now).toISOString(),
    },
    { provider: siweProvider, suppressExceptions: true },
  );
  if (!result.success) throw new Error('Invalid SIWE signature');

  return messageAddress;
}

export async function verifyThirdwebInAppAuthToken(
  token: string,
  expectedAddress?: string,
): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
  if (!clientId) throw new Error('NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not configured');

  const authHeaders = [
    `Bearer iaw-auth-token:${token}`,
    `Bearer embedded-wallet-token:${token}`,
    `Bearer ${token}`,
  ];
  let data: unknown = null;
  let lastStatus: number | null = null;

  for (const authorization of authHeaders) {
    const headers: Record<string, string> = {
      Authorization: authorization,
      'Content-Type': 'application/json',
      'x-thirdweb-client-id': clientId,
      'x-client-id': clientId,
    };
    if (process.env.THIRDWEB_SECRET_KEY) {
      headers['x-secret-key'] = process.env.THIRDWEB_SECRET_KEY;
    }

    const response = await fetch(
      process.env.THIRDWEB_IN_APP_ACCOUNTS_URL ||
        'https://embedded-wallet.thirdweb.com/api/2024-05-05/accounts',
      { headers, method: 'GET' },
    );

    lastStatus = response.status;
    if (response.ok) {
      data = await response.json();
      break;
    }
  }

  if (!data) {
    throw new Error(`Thirdweb auth token rejected (${lastStatus ?? 'unknown'})`);
  }

  const addresses = collectAddresses(data);

  const expected = expectedAddress?.toLowerCase();
  if (expected && addresses.length > 0 && !addresses.includes(expected)) {
    throw new Error('Thirdweb auth token wallet does not match request wallet');
  }
  const address = expected ? addresses.find((candidate) => candidate === expected) : addresses[0];
  if (!address) throw new Error('Thirdweb auth token did not resolve to a wallet');

  return address;
}

function collectAddresses(value: unknown, seen = new Set<unknown>()): string[] {
  if (!value || seen.has(value)) return [];

  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return /^0x[a-f0-9]{40}$/.test(normalized) ? [normalized] : [];
  }

  if (typeof value !== 'object') return [];
  seen.add(value);

  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => collectAddresses(item, seen)))];
  }

  return [
    ...new Set(
      Object.values(value as Record<string, unknown>).flatMap((item) =>
        collectAddresses(item, seen),
      ),
    ),
  ];
}

export async function verifyMemberRequest(req: NextRequest): Promise<MemberAuthResult> {
  if (hasWalletAuthHeaders(req)) {
    const walletAuth: WalletAuthResult = await verifyWalletRequest(req);
    if (!walletAuth.ok || !walletAuth.address) {
      return {
        ok: false,
        error: walletAuth.error,
        status: walletAuth.status,
      };
    }

    return { ok: true, address: walletAuth.address, provider: 'wallet' };
  }

  const session = readMemberSession(req);
  if (session.ok) return session;
  return session;
}
