import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ethers } from 'ethers';

// Use ThirdWeb's RPC — more reliable than the public Base endpoint
const RPC_URL = `https://8453.rpc.thirdweb.com/${process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}`;
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const ERC1155_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'];

async function isContributor(address: string): Promise<boolean> {
  try {
    const contractAddress = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    if (!contractAddress) return false;
    const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
    const balances = await Promise.all([1, 2, 3].map(id => contract.balanceOf(address, id)));
    return balances.some((b: ethers.BigNumber) => b.gt(0));
  } catch {
    return false;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null);
  if (!body?.address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });

  const address = (body.address as string).toLowerCase();
  const proposalId = params.id;

  const eligible = await isContributor(body.address);
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

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null);
  if (!body?.address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });

  const address = (body.address as string).toLowerCase();
  const proposalId = params.id;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('proposal_votes')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('voter_address', address);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
