import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { isContributor } from '@/lib/blockchain/check-nft-ownership';
import { verifyWalletRequest } from '@/lib/auth/verify-wallet-request';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Voter is the *recovered* signer, never a client-supplied field. Previously
  // anyone could cast a vote on behalf of every known (public) contributor
  // address and push a proposal past its threshold — which the cron then
  // auto-executes as a payout.
  const auth = await verifyWalletRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const address = auth.address!;

  const proposalId = params.id;

  const { isContributor: eligible } = await isContributor(address);
  if (!eligible) {
    return NextResponse.json({ error: 'Contributor status required to vote' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // Verify proposal exists and is open
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, status')
    .eq('id', proposalId)
    .single();

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (proposal.status !== 'open') return NextResponse.json({ error: 'Proposal is no longer open' }, { status: 409 });

  const { error } = await supabase
    .from('proposal_votes')
    .insert({ proposal_id: proposalId, voter_address: address });

  if (error?.code === '23505') {
    return NextResponse.json({ error: 'Already voted on this proposal' }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Increment vote count (fire-and-forget — vote is already recorded)
  try { await supabase.rpc('increment_proposal_votes', { p_id: proposalId }); } catch (_) {}

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Only the signer can retract their own vote.
  const auth = await verifyWalletRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const address = auth.address!;

  const proposalId = params.id;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('proposal_votes')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('voter_address', address);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Decrement vote count
  try { await supabase.rpc('decrement_proposal_votes', { p_id: proposalId }); } catch (_) {}

  return NextResponse.json({ success: true });
}
