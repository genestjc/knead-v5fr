import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = req.cookies.get('os_auth');
  if (auth?.value === 'true') return NextResponse.json({ ok: true });
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
  res.cookies.set('os_auth', 'true', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
