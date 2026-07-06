import { NextRequest, NextResponse } from 'next/server';
import {
  createOpenSourceAuthCookieValue,
  isOpenSourceRequestAuthorized,
  OPEN_SOURCE_AUTH_COOKIE,
  OPEN_SOURCE_AUTH_MAX_AGE_SECONDS,
} from '@/lib/open-source-auth';

export async function GET(req: NextRequest) {
  if (isOpenSourceRequestAuthorized(req)) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));
  const expected = process.env.OPEN_SOURCE_PASSWORD;

  if (!expected) {
    console.error('OPEN_SOURCE_PASSWORD env var not set');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!password || password !== expected) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPEN_SOURCE_AUTH_COOKIE, createOpenSourceAuthCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: OPEN_SOURCE_AUTH_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
