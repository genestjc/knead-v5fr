import { NextRequest, NextResponse } from 'next/server';
import { sendUsdc } from '@/lib/agentcard';
import { getWalletAgentRole } from '@/lib/agent/role-gate';
import { verifyWalletRequest } from '@/lib/auth/verify-wallet-request';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Sender is the *recovered* signer, never a client-supplied field — a
    // public wallet address alone must not authorize a treasury transfer.
    const auth = await verifyWalletRequest(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const senderAddress = auth.address!;

    const { toAddress, amountUsdc, memo } = await req.json();
    if (!toAddress || !amountUsdc || !memo) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    const { allowed, role } = await getWalletAgentRole(senderAddress);
    if (!allowed) return NextResponse.json({ error: 'Forbidden: Admin or Contributor role required' }, { status: 403 });
    const result = await sendUsdc(toAddress, amountUsdc);
    if (!result.txHash) return NextResponse.json({ error: 'Transfer completed but no tx hash returned' }, { status: 502 });
    return NextResponse.json({ success: true, role, txHash: result.txHash, amount: result.amount, to: result.to });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
