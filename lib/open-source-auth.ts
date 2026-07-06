import type { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const OPEN_SOURCE_AUTH_COOKIE = 'os_auth';
export const OPEN_SOURCE_AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getCookieSecret(): string | null {
  return process.env.OPEN_SOURCE_PASSWORD || process.env.AUTH_SECRET || null;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createOpenSourceAuthCookieValue(now = Date.now()): string {
  const secret = getCookieSecret();
  if (!secret) throw new Error('Open-source auth cookie secret is not configured');
  const payload = String(now);
  return `${payload}.${sign(payload, secret)}`;
}

export function isOpenSourceRequestAuthorized(req: NextRequest): boolean {
  const secret = getCookieSecret();
  if (!secret) return false;

  const value = req.cookies.get(OPEN_SOURCE_AUTH_COOKIE)?.value;
  if (!value) return false;

  const [issuedAt, signature] = value.split('.');
  if (!issuedAt || !signature || !/^\d+$/.test(issuedAt)) return false;

  const ageSeconds = (Date.now() - Number(issuedAt)) / 1000;
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0 || ageSeconds > OPEN_SOURCE_AUTH_MAX_AGE_SECONDS) {
    return false;
  }

  return safeEqual(signature, sign(issuedAt, secret));
}

