import { NextRequest, NextResponse } from 'next/server';
import { initAgentListener, stopAgentListener, isListenerRunning } from '@/lib/towns/agent-listener';

export const dynamic = 'force-dynamic';

function authenticate(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authenticate(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ running: isListenerRunning() });
}

export async function POST(req: NextRequest) {
  if (!authenticate(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if ((body as any).action === 'stop') {
    await stopAgentListener();
    return NextResponse.json({ running: false });
  }
  await initAgentListener();
  return NextResponse.json({ running: isListenerRunning() });
}
