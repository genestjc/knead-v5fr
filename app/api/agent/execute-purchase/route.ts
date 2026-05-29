import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent';
import { getWalletAgentRole } from '@/lib/agent/role-gate';
import { postToTownsChannel } from '@/lib/towns/agent-listener';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { senderAddress, command, channelId, proposalId } = await req.json();
    if (!senderAddress || !command) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    const { allowed, role } = await getWalletAgentRole(senderAddress);
    if (!allowed) return NextResponse.json({ error: 'Forbidden: Admin or Contributor role required' }, { status: 403 });
    const result = await runAgent({ command, senderAddress, channelId, proposalId }, postToTownsChannel);
    return NextResponse.json({ success: result.success, role, result });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
