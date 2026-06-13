import { NextRequest, NextResponse } from 'next/server';
import { requestCard } from '@/lib/agentcard';
import { getWalletAgentRole } from '@/lib/agent/role-gate';
import { verifyWalletRequest } from '@/lib/auth/verify-wallet-request';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Sender is the *recovered* signer, never a client-supplied field — this
    // mints a funded virtual card.
    const auth = await verifyWalletRequest(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const senderAddress = auth.address!;

    const { amountUsd, purpose } = await req.json();
    if (!amountUsd || !purpose) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    const { allowed, role } = await getWalletAgentRole(senderAddress);
    if (!allowed) return NextResponse.json({ error: 'Forbidden: Admin or Contributor role required' }, { status: 403 });
    const card = await requestCard(amountUsd);
    return NextResponse.json({ success: true, role, card });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
