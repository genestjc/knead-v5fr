import { NextRequest, NextResponse } from 'next/server';
import { requestCard } from '@/lib/agentcard';
import { getWalletAgentRole } from '@/lib/agent/role-gate';
import { verifyWalletRequest } from '@/lib/auth/verify-wallet-request';
import { rateLimit } from '@/lib/rate-limit';

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
    const amount = Number(amountUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amountUsd must be a positive number' }, { status: 400 });
    }
    const { allowed, role } = await getWalletAgentRole(senderAddress);
    if (!allowed) return NextResponse.json({ error: 'Forbidden: Admin or Contributor role required' }, { status: 403 });
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden: Admin role required for funded cards' }, { status: 403 });
    const limit = await rateLimit('agent-request-card', senderAddress, { limit: 5, windowSeconds: 60 * 60 });
    if (!limit.success) return NextResponse.json({ error: 'Too many card requests. Please slow down.' }, { status: 429 });
    const card = await requestCard(amount);
    return NextResponse.json({
      success: true,
      role,
      card: {
        last4: card.pan.slice(-4),
        expiry: card.expiry,
        billingZip: card.billing_zip,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
